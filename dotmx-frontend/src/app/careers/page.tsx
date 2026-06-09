"use client";

import { Layout } from "@/components/common";
import {
  Rocket,
  Globe,
  Gem,
  MapPin,
  Clock,
  Building2,
  Briefcase,
  ChevronRight,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type {
  JobPosting,
  JobType,
  JobLocation,
  PaginatedResponse,
} from "@/services/ApiClient";

// Job type badge colors
const jobTypeColors: Record<JobType, string> = {
  "full-time": "bg-green-500/20 text-green-400 border-green-500/30",
  "part-time": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contract: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  internship: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

// Location badge colors
const locationColors: Record<JobLocation, string> = {
  remote: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  hybrid: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  onsite: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

// Format job type for display
function formatJobType(type: JobType): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace("-", " ");
}

// Format location for display
function formatLocation(location: JobLocation): string {
  return location.charAt(0).toUpperCase() + location.slice(1);
}

// Job Card Component
function JobCard({
  job,
  onApply,
}: {
  job: JobPosting;
  onApply: (job: JobPosting) => void;
}) {
  return (
    <div className="group rounded-2xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg transition-all duration-300 hover:border-[#3A8DFF]/50 hover:shadow-[#3A8DFF]/10">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-2 text-xl font-bold text-white transition-colors group-hover:text-[#3A8DFF]">
            {job.title}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#A3B8D9]">
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {job.department}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.location_details || formatLocation(job.location)}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-4 line-clamp-3 text-[#A3B8D9]">{job.description}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${jobTypeColors[job.type]}`}
        >
          <Clock className="mr-1 inline-block h-3 w-3" />
          {formatJobType(job.type)}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${locationColors[job.location]}`}
        >
          <Globe className="mr-1 inline-block h-3 w-3" />
          {formatLocation(job.location)}
        </span>
        {job.salary_range && (
          <span className="rounded-full border border-[#23345C] bg-[#0A1733] px-3 py-1 text-xs font-medium text-[#A3B8D9]">
            <Briefcase className="mr-1 inline-block h-3 w-3" />
            {job.salary_range}
          </span>
        )}
      </div>

      <button
        onClick={() => onApply(job)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-4 py-3 font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#3A8DFF]/30"
      >
        Apply Now
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// Filter Button Component
function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "border-[#3A8DFF] bg-[#3A8DFF]/20 text-[#3A8DFF]"
          : "border-[#23345C] bg-[#0A1733] text-[#A3B8D9] hover:border-[#3A8DFF]/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function CareersPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null
  );
  const [selectedType, setSelectedType] = useState<JobType | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<JobLocation | null>(
    null
  );

  // Fetch jobs from API
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedDepartment) params.set("department", selectedDepartment);
      if (selectedType) params.set("type", selectedType);
      if (selectedLocation) params.set("location", selectedLocation);

      const queryString = params.toString();
      const response = await fetch(
        `/api/careers${queryString ? `?${queryString}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch job postings");
      }

      const data: PaginatedResponse<JobPosting> = await response.json();
      setJobs(data.data);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError("Failed to load job postings. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [selectedDepartment, selectedType, selectedLocation]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Filter jobs by search query
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.title.toLowerCase().includes(query) ||
      job.department.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query)
    );
  });

  // Get unique departments from jobs
  const departments = [...new Set(jobs.map((job) => job.department))];

  // Handle apply click
  const handleApply = (job: JobPosting) => {
    if (job.application_url) {
      window.open(job.application_url, "_blank");
    } else {
      // Default to contact page with job reference
      window.location.href = `/contact?subject=Job Application: ${encodeURIComponent(job.title)}`;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedDepartment(null);
    setSelectedType(null);
    setSelectedLocation(null);
    setSearchQuery("");
  };

  const hasActiveFilters =
    selectedDepartment || selectedType || selectedLocation || searchQuery;

  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Careers at DOTMX</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#A3B8D9]">
            Join our team and help shape the future of decentralized finance
            trading. We&apos;re building something revolutionary.
          </p>
        </div>

        {/* Why Join Us Section */}
        <div className="mx-auto mb-16 max-w-6xl">
          <div className="rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
            <h2 className="mb-8 text-center text-3xl font-bold text-white">
              Why Join Us?
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <h4 className="mb-2 text-xl font-bold text-white">
                  Innovation
                </h4>
                <p className="text-[#A3B8D9]">
                  Work on cutting-edge DeFi technology and shape the future of
                  finance
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <h4 className="mb-2 text-xl font-bold text-white">
                  Remote First
                </h4>
                <p className="text-[#A3B8D9]">
                  Global team with flexible work arrangements and async culture
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                  <Gem className="h-8 w-8 text-white" />
                </div>
                <h4 className="mb-2 text-xl font-bold text-white">Growth</h4>
                <p className="text-[#A3B8D9]">
                  Competitive packages, equity, and career development
                  opportunities
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Open Positions Section */}
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-3xl font-bold">
              <span className="gradient-text">Open Positions</span>
              {!loading && (
                <span className="ml-3 text-lg font-normal text-[#A3B8D9]">
                  ({filteredJobs.length}{" "}
                  {filteredJobs.length === 1 ? "role" : "roles"})
                </span>
              )}
            </h2>

            {/* Search */}
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-[#A3B8D9]" />
              <input
                type="text"
                placeholder="Search positions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#23345C] bg-[#0A1733] py-3 pr-4 pl-10 text-white placeholder-[#A3B8D9]/50 transition-all focus:border-[#3A8DFF] focus:ring-1 focus:ring-[#3A8DFF] focus:outline-none sm:w-80"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <Filter className="h-5 w-5 text-[#A3B8D9]" />

            {/* Department Filters */}
            <FilterButton
              label="All Departments"
              active={!selectedDepartment}
              onClick={() => setSelectedDepartment(null)}
            />
            {departments.map((dept) => (
              <FilterButton
                key={dept}
                label={dept}
                active={selectedDepartment === dept}
                onClick={() =>
                  setSelectedDepartment(
                    selectedDepartment === dept ? null : dept
                  )
                }
              />
            ))}

            <span className="mx-2 text-[#23345C]">|</span>

            {/* Type Filters */}
            <FilterButton
              label="All Types"
              active={!selectedType}
              onClick={() => setSelectedType(null)}
            />
            <FilterButton
              label="Full-time"
              active={selectedType === "full-time"}
              onClick={() =>
                setSelectedType(
                  selectedType === "full-time" ? null : "full-time"
                )
              }
            />
            <FilterButton
              label="Remote"
              active={selectedLocation === "remote"}
              onClick={() =>
                setSelectedLocation(
                  selectedLocation === "remote" ? null : "remote"
                )
              }
            />

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-2 text-sm text-[#A3B8D9] underline hover:text-white"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Job Listings */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#3A8DFF]" />
              <p className="text-[#A3B8D9]">Loading positions...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <p className="mb-4 text-red-400">{error}</p>
              <button
                onClick={fetchJobs}
                className="rounded-xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-6 py-2 font-semibold text-white transition-all hover:scale-105"
              >
                Try Again
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-[#23345C] bg-[#122347] p-12 text-center">
              <Briefcase className="mx-auto mb-4 h-16 w-16 text-[#A3B8D9]/50" />
              <h3 className="mb-2 text-xl font-bold text-white">
                No positions found
              </h3>
              <p className="mb-6 text-[#A3B8D9]">
                {hasActiveFilters
                  ? "Try adjusting your filters or search query."
                  : "Check back later for new opportunities."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="rounded-xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-6 py-2 font-semibold text-white transition-all hover:scale-105"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onApply={handleApply} />
              ))}
            </div>
          )}

          {/* Don't see a fit section */}
          <div className="mt-16 text-center">
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <h3 className="mb-4 text-2xl font-bold text-white">
                Don&apos;t see a position that fits?
              </h3>
              <p className="mb-6 text-lg text-[#A3B8D9]">
                We&apos;re always looking for exceptional talent. Send us your
                resume and tell us how you can contribute.
              </p>
              <a
                href="/contact?subject=General Application"
                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-8 py-4 font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#3A8DFF]/30"
              >
                Get in Touch
                <ChevronRight className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
