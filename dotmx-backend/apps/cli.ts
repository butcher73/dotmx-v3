#!/usr/bin/env bun
/**
 * DotMX CLI Entry Point
 */

import { main } from "@dotmx/tools";

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
