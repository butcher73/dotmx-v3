//! Write-Ahead Log (WAL) for crash recovery
//!
//! Provides durable persistence of engine state by writing all mutations
//! to an append-only log before they are applied. On recovery, the WAL
//! is replayed to reconstruct the engine state.
//!
//! Architecture:
//! - Append-only binary log file with CRC32 checksums
//! - Periodic snapshots to truncate the log
//! - Recovery reads snapshot + replays WAL entries after snapshot

use crate::types::*;
use parking_lot::Mutex;
use std::collections::VecDeque;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

/// WAL entry types that represent all state mutations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum WalEntry {
    /// A new order was submitted
    OrderSubmitted {
        order: Order,
        sequence: u64,
    },
    /// An order was cancelled
    OrderCancelled {
        order_id: OrderId,
        sequence: u64,
    },
    /// A trade was executed
    TradeExecuted {
        trade: Trade,
        sequence: u64,
    },
    /// Order was modified
    OrderModified {
        order_id: OrderId,
        new_price: Option<Decimal>,
        new_quantity: Option<Decimal>,
        sequence: u64,
    },
    /// Snapshot checkpoint marker — entries before this can be truncated
    SnapshotCheckpoint {
        snapshot_path: String,
        sequence: u64,
    },
}

impl WalEntry {
    /// Get the sequence number of this entry
    pub fn sequence(&self) -> u64 {
        match self {
            WalEntry::OrderSubmitted { sequence, .. } => *sequence,
            WalEntry::OrderCancelled { sequence, .. } => *sequence,
            WalEntry::TradeExecuted { sequence, .. } => *sequence,
            WalEntry::OrderModified { sequence, .. } => *sequence,
            WalEntry::SnapshotCheckpoint { sequence, .. } => *sequence,
        }
    }
}

/// Serialized WAL frame with length prefix and CRC32 checksum
///
/// Frame format:
/// [4 bytes: payload length (u32 LE)]
/// [4 bytes: CRC32 checksum (u32 LE)]
/// [N bytes: JSON payload]
#[derive(Debug)]
struct WalFrame {
    payload: Vec<u8>,
    checksum: u32,
}

impl WalFrame {
    fn new(entry: &WalEntry) -> io::Result<Self> {
        let payload = serde_json::to_vec(entry)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        let checksum = crc32_simple(&payload);
        Ok(Self { payload, checksum })
    }

    fn write_to<W: Write>(&self, writer: &mut W) -> io::Result<()> {
        let len = self.payload.len() as u32;
        writer.write_all(&len.to_le_bytes())?;
        writer.write_all(&self.checksum.to_le_bytes())?;
        writer.write_all(&self.payload)?;
        Ok(())
    }

    fn read_from<R: Read>(reader: &mut R) -> io::Result<Option<Self>> {
        let mut len_bytes = [0u8; 4];
        match reader.read_exact(&mut len_bytes) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
            Err(e) => return Err(e),
        }
        let len = u32::from_le_bytes(len_bytes) as usize;

        let mut checksum_bytes = [0u8; 4];
        reader.read_exact(&mut checksum_bytes)?;
        let checksum = u32::from_le_bytes(checksum_bytes);

        let mut payload = vec![0u8; len];
        reader.read_exact(&mut payload)?;

        // Verify checksum
        let computed = crc32_simple(&payload);
        if computed != checksum {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("WAL checksum mismatch: expected {checksum}, got {computed}"),
            ));
        }

        Ok(Some(Self { payload, checksum }))
    }

    fn decode(&self) -> io::Result<WalEntry> {
        serde_json::from_slice(&self.payload)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }
}

/// Simple CRC32 implementation (IEEE polynomial)
fn crc32_simple(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

/// Write-Ahead Log writer
///
/// Thread-safe, append-only log writer with fsync support.
pub struct WalWriter {
    inner: Mutex<WalWriterInner>,
}

struct WalWriterInner {
    writer: BufWriter<File>,
    path: PathBuf,
    entries_since_sync: u32,
    /// How often to fsync (every N entries). 0 = every entry.
    sync_interval: u32,
    /// Total entries written
    total_entries: u64,
}

/// Configuration for WAL behavior
#[derive(Debug, Clone)]
pub struct WalConfig {
    /// Directory to store WAL files
    pub dir: PathBuf,
    /// How often to fsync (0 = every entry, N = every N entries)
    pub sync_interval: u32,
    /// Maximum WAL file size before rotation (bytes)
    pub max_file_size: u64,
    /// Whether to create the directory if it doesn't exist
    pub create_dir: bool,
}

impl Default for WalConfig {
    fn default() -> Self {
        Self {
            dir: PathBuf::from("data/wal"),
            sync_interval: 100,
            max_file_size: 64 * 1024 * 1024, // 64 MB
            create_dir: true,
        }
    }
}

impl WalWriter {
    /// Create a new WAL writer
    pub fn new(config: &WalConfig) -> io::Result<Self> {
        if config.create_dir {
            fs::create_dir_all(&config.dir)?;
        }

        let path = config.dir.join("wal.log");
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;

        Ok(Self {
            inner: Mutex::new(WalWriterInner {
                writer: BufWriter::new(file),
                path,
                entries_since_sync: 0,
                sync_interval: config.sync_interval,
                total_entries: 0,
            }),
        })
    }

    /// Append an entry to the WAL
    pub fn append(&self, entry: &WalEntry) -> io::Result<()> {
        let mut inner = self.inner.lock();
        let frame = WalFrame::new(entry)?;
        frame.write_to(&mut inner.writer)?;
        inner.entries_since_sync += 1;
        inner.total_entries += 1;

        // Periodic fsync
        if inner.sync_interval == 0 || inner.entries_since_sync >= inner.sync_interval {
            inner.writer.flush()?;
            inner.writer.get_ref().sync_data()?;
            inner.entries_since_sync = 0;
        }

        Ok(())
    }

    /// Force sync all buffered data to disk
    pub fn sync(&self) -> io::Result<()> {
        let mut inner = self.inner.lock();
        inner.writer.flush()?;
        inner.writer.get_ref().sync_data()?;
        inner.entries_since_sync = 0;
        Ok(())
    }

    /// Get total entries written
    pub fn total_entries(&self) -> u64 {
        self.inner.lock().total_entries
    }

    /// Get the WAL file path
    pub fn path(&self) -> PathBuf {
        self.inner.lock().path.clone()
    }

    /// Truncate the WAL (after a snapshot)
    pub fn truncate(&self) -> io::Result<()> {
        let mut inner = self.inner.lock();
        inner.writer.flush()?;

        // Reopen the file in truncate mode
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&inner.path)?;
        inner.writer = BufWriter::new(file);
        inner.entries_since_sync = 0;
        inner.total_entries = 0;
        Ok(())
    }
}

/// WAL reader for recovery
pub struct WalReader;

impl WalReader {
    /// Read all valid entries from a WAL file
    pub fn read_all(path: &Path) -> io::Result<Vec<WalEntry>> {
        if !path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut entries = Vec::new();

        loop {
            match WalFrame::read_from(&mut reader) {
                Ok(Some(frame)) => {
                    match frame.decode() {
                        Ok(entry) => entries.push(entry),
                        Err(e) => {
                            // Corrupted entry — stop reading (partial write)
                            eprintln!("WAL: corrupted entry, stopping recovery: {e}");
                            break;
                        }
                    }
                }
                Ok(None) => break, // EOF
                Err(e) => {
                    eprintln!("WAL: read error, stopping recovery: {e}");
                    break;
                }
            }
        }

        Ok(entries)
    }

    /// Read entries after a given sequence number
    pub fn read_from_sequence(path: &Path, after_sequence: u64) -> io::Result<Vec<WalEntry>> {
        let all = Self::read_all(path)?;
        Ok(all.into_iter().filter(|e| e.sequence() > after_sequence).collect())
    }
}

/// Snapshot manager for periodic state snapshots
///
/// Snapshots capture the full orderbook state so the WAL can be truncated.
pub struct SnapshotManager {
    dir: PathBuf,
    /// How many entries between snapshots
    snapshot_interval: u64,
    entries_since_snapshot: u64,
}

impl SnapshotManager {
    /// Create a new snapshot manager
    pub fn new(dir: PathBuf, snapshot_interval: u64) -> io::Result<Self> {
        fs::create_dir_all(&dir)?;
        Ok(Self {
            dir,
            snapshot_interval,
            entries_since_snapshot: 0,
        })
    }

    /// Record that an entry was written; returns true if snapshot is due
    pub fn tick(&mut self) -> bool {
        self.entries_since_snapshot += 1;
        self.entries_since_snapshot >= self.snapshot_interval
    }

    /// Reset the counter after snapshot
    pub fn reset(&mut self) {
        self.entries_since_snapshot = 0;
    }

    /// Save a snapshot to disk
    pub fn save_snapshot(&self, snapshot: &SnapshotData, sequence: u64) -> io::Result<PathBuf> {
        let filename = format!("snapshot_{sequence}.json");
        let path = self.dir.join(&filename);
        let json = serde_json::to_vec_pretty(snapshot)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(&path, json)?;
        Ok(path)
    }

    /// Load the latest snapshot
    pub fn load_latest_snapshot(&self) -> io::Result<Option<(SnapshotData, u64)>> {
        let mut snapshots: Vec<(u64, PathBuf)> = Vec::new();

        for entry in fs::read_dir(&self.dir)? {
            let entry = entry?;
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("snapshot_") && name_str.ends_with(".json") {
                if let Some(seq_str) = name_str
                    .strip_prefix("snapshot_")
                    .and_then(|s| s.strip_suffix(".json"))
                {
                    if let Ok(seq) = seq_str.parse::<u64>() {
                        snapshots.push((seq, entry.path()));
                    }
                }
            }
        }

        snapshots.sort_by_key(|(seq, _)| *seq);

        if let Some((seq, path)) = snapshots.last() {
            let data = fs::read(path)?;
            let snapshot: SnapshotData = serde_json::from_slice(&data)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            Ok(Some((snapshot, *seq)))
        } else {
            Ok(None)
        }
    }

    /// Clean old snapshots, keeping only the latest N
    pub fn cleanup(&self, keep: usize) -> io::Result<()> {
        let mut snapshots: Vec<(u64, PathBuf)> = Vec::new();

        for entry in fs::read_dir(&self.dir)? {
            let entry = entry?;
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("snapshot_") && name_str.ends_with(".json") {
                if let Some(seq_str) = name_str
                    .strip_prefix("snapshot_")
                    .and_then(|s| s.strip_suffix(".json"))
                {
                    if let Ok(seq) = seq_str.parse::<u64>() {
                        snapshots.push((seq, entry.path()));
                    }
                }
            }
        }

        snapshots.sort_by_key(|(seq, _)| *seq);

        if snapshots.len() > keep {
            let to_remove = snapshots.len() - keep;
            for (_, path) in snapshots.into_iter().take(to_remove) {
                fs::remove_file(path)?;
            }
        }

        Ok(())
    }
}

/// Full engine snapshot data
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SnapshotData {
    /// Sequence number at snapshot time
    pub sequence: u64,
    /// All open orders
    pub open_orders: Vec<Order>,
    /// Recent trades (last N)
    pub recent_trades: Vec<Trade>,
    /// Timestamp
    pub timestamp: u64,
}

/// Recovery result from WAL replay
#[derive(Debug)]
pub struct RecoveryResult {
    /// Orders recovered
    pub orders: Vec<Order>,
    /// Trades recovered
    pub trades: Vec<Trade>,
    /// Cancelled order IDs
    pub cancelled_order_ids: Vec<OrderId>,
    /// Last sequence number
    pub last_sequence: u64,
    /// Number of WAL entries replayed
    pub entries_replayed: u64,
    /// Whether a snapshot was loaded
    pub snapshot_loaded: bool,
}

/// Recover engine state from snapshot + WAL
pub fn recover(
    snapshot_dir: &Path,
    wal_path: &Path,
) -> io::Result<RecoveryResult> {
    let snapshot_mgr = SnapshotManager::new(snapshot_dir.to_path_buf(), 0)?;

    let mut orders: Vec<Order> = Vec::new();
    let mut trades: Vec<Trade> = Vec::new();
    let mut cancelled: Vec<OrderId> = Vec::new();
    let mut last_sequence: u64 = 0;
    let mut snapshot_loaded = false;

    // 1. Load latest snapshot if available
    if let Some((snapshot, seq)) = snapshot_mgr.load_latest_snapshot()? {
        orders = snapshot.open_orders;
        trades = snapshot.recent_trades;
        last_sequence = seq;
        snapshot_loaded = true;
    }

    // 2. Replay WAL entries after snapshot sequence
    let wal_entries = WalReader::read_from_sequence(wal_path, last_sequence)?;
    let entries_replayed = wal_entries.len() as u64;

    for entry in wal_entries {
        match entry {
            WalEntry::OrderSubmitted { order, sequence } => {
                orders.push(order);
                last_sequence = last_sequence.max(sequence);
            }
            WalEntry::OrderCancelled { order_id, sequence } => {
                orders.retain(|o| o.id != order_id);
                cancelled.push(order_id);
                last_sequence = last_sequence.max(sequence);
            }
            WalEntry::TradeExecuted { trade, sequence } => {
                trades.push(trade);
                last_sequence = last_sequence.max(sequence);
            }
            WalEntry::OrderModified { order_id, new_price, new_quantity, sequence } => {
                if let Some(order) = orders.iter_mut().find(|o| o.id == order_id) {
                    if let Some(p) = new_price {
                        order.price = p;
                    }
                    if let Some(q) = new_quantity {
                        order.quantity = q;
                    }
                }
                last_sequence = last_sequence.max(sequence);
            }
            WalEntry::SnapshotCheckpoint { sequence, .. } => {
                last_sequence = last_sequence.max(sequence);
            }
        }
    }

    Ok(RecoveryResult {
        orders,
        trades,
        cancelled_order_ids: cancelled,
        last_sequence,
        entries_replayed,
        snapshot_loaded,
    })
}

/// In-memory WAL for testing (no disk IO)
pub struct InMemoryWal {
    entries: Mutex<VecDeque<WalEntry>>,
}

impl InMemoryWal {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(VecDeque::new()),
        }
    }

    pub fn append(&self, entry: WalEntry) {
        self.entries.lock().push_back(entry);
    }

    pub fn entries(&self) -> Vec<WalEntry> {
        self.entries.lock().iter().cloned().collect()
    }

    pub fn len(&self) -> usize {
        self.entries.lock().len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.lock().is_empty()
    }

    pub fn clear(&self) {
        self.entries.lock().clear();
    }

    /// Replay entries after a given sequence
    pub fn entries_after(&self, sequence: u64) -> Vec<WalEntry> {
        self.entries.lock().iter()
            .filter(|e| e.sequence() > sequence)
            .cloned()
            .collect()
    }
}

impl Default for InMemoryWal {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("dotmx_wal_test_{}_{}", std::process::id(), name));
        // Clean up any leftover from previous runs
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_crc32() {
        let data = b"hello world";
        let crc = crc32_simple(data);
        // Known CRC32 of "hello world"
        assert_eq!(crc, 0x0D4A_1185);
    }

    #[test]
    fn test_wal_write_and_read() {
        let dir = temp_dir("write_read");
        let config = WalConfig {
            dir: dir.clone(),
            sync_interval: 0, // sync every entry
            max_file_size: 64 * 1024 * 1024,
            create_dir: true,
        };

        let writer = WalWriter::new(&config).unwrap();

        let order = Order::new_limit(
            UserId::new("user1"),
            Symbol::new("BTC-USD"),
            Side::Buy,
            to_decimal(50000.0),
            to_decimal(1.0),
            TimeInForce::GTC,
            1,
        );

        writer.append(&WalEntry::OrderSubmitted {
            order: order.clone(),
            sequence: 1,
        }).unwrap();

        writer.append(&WalEntry::OrderCancelled {
            order_id: order.id,
            sequence: 2,
        }).unwrap();

        writer.sync().unwrap();
        assert_eq!(writer.total_entries(), 2);

        // Read back
        let entries = WalReader::read_all(&writer.path()).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].sequence(), 1);
        assert_eq!(entries[1].sequence(), 2);

        cleanup(&dir);
    }

    #[test]
    fn test_wal_truncate() {
        let dir = temp_dir("truncate");
        let config = WalConfig {
            dir: dir.clone(),
            sync_interval: 0,
            max_file_size: 64 * 1024 * 1024,
            create_dir: true,
        };

        let writer = WalWriter::new(&config).unwrap();

        writer.append(&WalEntry::OrderCancelled {
            order_id: OrderId::new(),
            sequence: 1,
        }).unwrap();

        writer.truncate().unwrap();
        assert_eq!(writer.total_entries(), 0);

        let entries = WalReader::read_all(&writer.path()).unwrap();
        assert!(entries.is_empty());

        cleanup(&dir);
    }

    #[test]
    fn test_snapshot_save_and_load() {
        let dir = temp_dir("snap_save_load").join("snapshots");
        let mgr = SnapshotManager::new(dir.clone(), 100).unwrap();

        let snapshot = SnapshotData {
            sequence: 42,
            open_orders: vec![
                Order::new_limit(
                    UserId::new("u1"), Symbol::new("BTC"), Side::Buy,
                    to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
                ),
            ],
            recent_trades: vec![],
            timestamp: 1000,
        };

        mgr.save_snapshot(&snapshot, 42).unwrap();

        let loaded = mgr.load_latest_snapshot().unwrap();
        assert!(loaded.is_some());
        let (data, seq) = loaded.unwrap();
        assert_eq!(seq, 42);
        assert_eq!(data.open_orders.len(), 1);
        assert_eq!(data.sequence, 42);

        cleanup(&dir);
    }

    #[test]
    fn test_snapshot_cleanup() {
        let dir = temp_dir("snap_cleanup").join("snap_cleanup");
        let mgr = SnapshotManager::new(dir.clone(), 10).unwrap();

        let empty_snap = SnapshotData {
            sequence: 0,
            open_orders: vec![],
            recent_trades: vec![],
            timestamp: 0,
        };

        for i in 1..=5 {
            let mut s = empty_snap.clone();
            s.sequence = i;
            mgr.save_snapshot(&s, i).unwrap();
        }

        // Keep only 2
        mgr.cleanup(2).unwrap();

        let files: Vec<_> = fs::read_dir(&dir).unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("snapshot_"))
            .collect();
        assert_eq!(files.len(), 2);

        cleanup(&dir);
    }

    #[test]
    fn test_recovery_from_wal() {
        let dir = temp_dir("recovery");
        let wal_config = WalConfig {
            dir: dir.clone(),
            sync_interval: 0,
            create_dir: true,
            ..Default::default()
        };

        let writer = WalWriter::new(&wal_config).unwrap();

        let order = Order::new_limit(
            UserId::new("u1"), Symbol::new("BTC"), Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );

        writer.append(&WalEntry::OrderSubmitted {
            order: order.clone(),
            sequence: 1,
        }).unwrap();

        let trade = Trade::new(
            Symbol::new("BTC"), to_decimal(100.0), to_decimal(0.5),
            order.id, OrderId::new(),
            UserId::new("u1"), UserId::new("u2"),
            Side::Buy, Side::Sell, 1,
        );

        writer.append(&WalEntry::TradeExecuted {
            trade,
            sequence: 2,
        }).unwrap();
        writer.sync().unwrap();

        let snap_dir = dir.join("snapshots");
        fs::create_dir_all(&snap_dir).unwrap();

        let result = recover(&snap_dir, &writer.path()).unwrap();
        assert_eq!(result.orders.len(), 1);
        assert_eq!(result.trades.len(), 1);
        assert_eq!(result.last_sequence, 2);
        assert!(!result.snapshot_loaded);
        assert_eq!(result.entries_replayed, 2);

        cleanup(&dir);
    }

    #[test]
    fn test_in_memory_wal() {
        let wal = InMemoryWal::new();
        assert!(wal.is_empty());

        wal.append(WalEntry::OrderCancelled {
            order_id: OrderId::new(),
            sequence: 1,
        });
        wal.append(WalEntry::OrderCancelled {
            order_id: OrderId::new(),
            sequence: 2,
        });
        wal.append(WalEntry::OrderCancelled {
            order_id: OrderId::new(),
            sequence: 3,
        });

        assert_eq!(wal.len(), 3);

        let after = wal.entries_after(1);
        assert_eq!(after.len(), 2);

        wal.clear();
        assert!(wal.is_empty());
    }

    #[test]
    fn test_snapshot_tick() {
        let dir = temp_dir("tick_test").join("tick_test");
        let mut mgr = SnapshotManager::new(dir.clone(), 3).unwrap();

        assert!(!mgr.tick()); // 1
        assert!(!mgr.tick()); // 2
        assert!(mgr.tick());  // 3 - snapshot due!
        mgr.reset();
        assert!(!mgr.tick()); // 1 again

        cleanup(&dir);
    }
}
