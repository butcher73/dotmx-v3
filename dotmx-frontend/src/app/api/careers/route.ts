import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Types matching the frontend
interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: "remote" | "hybrid" | "onsite";
  location_details?: string;
  type: "full-time" | "part-time" | "contract" | "internship";
  description: string;
  requirements?: string[];
  benefits?: string[];
  salary_range?: string;
  application_url?: string;
  status: "active" | "inactive" | "filled";
  created_at: string;
  updated_at?: string;
}

/**
 * GET /api/careers
 * Fetches job postings from the backend API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const type = searchParams.get("type");
    const location = searchParams.get("location");
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";

    // Get backend API URL from environment
    // Note: This runs SERVER-SIDE (Next.js API route)
    // In dev: use relative path for consistency. Next.js will resolve it correctly
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

    // Build query string
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (type) params.set("type", type);
    if (location) params.set("location", location);
    params.set("page", page);
    params.set("limit", limit);

    const queryString = params.toString();
    const url = `${apiUrl}/careers/jobs${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Cache for 5 minutes
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      // If backend is not available or returns error, return mock data for development
      if (response.status === 404 || response.status >= 500) {
        return NextResponse.json({
          data: getMockJobPostings(),
          page: parseInt(page),
          limit: parseInt(limit),
          total: getMockJobPostings().length,
          total_pages: 1,
        });
      }

      return NextResponse.json(
        { error: "Failed to fetch job postings" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching careers:", error);

    // Return mock data in case of connection errors (for development)
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";

    return NextResponse.json({
      data: getMockJobPostings(),
      page: parseInt(page),
      limit: parseInt(limit),
      total: getMockJobPostings().length,
      total_pages: 1,
    });
  }
}

/**
 * Mock job postings for development/fallback
 */
function getMockJobPostings(): JobPosting[] {
  return [
    {
      id: "1",
      title: "Senior Frontend Developer",
      department: "Engineering",
      location: "remote",
      location_details: "Worldwide",
      type: "full-time",
      description:
        "We're looking for an experienced Frontend Developer to join our team and help build the next generation of DeFi trading interfaces. You'll work with React, TypeScript, and Web3 technologies to create intuitive and performant user experiences.",
      requirements: [
        "5+ years of frontend development experience",
        "Strong proficiency in React and TypeScript",
        "Experience with Web3/blockchain applications",
        "Understanding of DeFi protocols",
        "Excellent problem-solving skills",
      ],
      benefits: [
        "Competitive salary + equity",
        "Remote-first culture",
        "Flexible working hours",
        "Learning & development budget",
      ],
      salary_range: "$120,000 - $180,000",
      status: "active",
      created_at: "2025-12-15T00:00:00Z",
    },
    {
      id: "2",
      title: "Blockchain Engineer",
      department: "Engineering",
      location: "remote",
      location_details: "Worldwide",
      type: "full-time",
      description:
        "Join our core engineering team to develop and maintain smart contracts and blockchain infrastructure. You'll work on cutting-edge DeFi protocols and help shape the future of decentralized trading.",
      requirements: [
        "3+ years of Solidity development",
        "Experience with EVM-compatible chains",
        "Knowledge of DeFi protocols (AMMs, lending, derivatives)",
        "Security-first mindset",
        "Smart contract auditing experience is a plus",
      ],
      benefits: [
        "Competitive salary + equity",
        "Remote-first culture",
        "Flexible working hours",
        "Conference attendance budget",
      ],
      salary_range: "$140,000 - $200,000",
      status: "active",
      created_at: "2025-12-10T00:00:00Z",
    },
    {
      id: "3",
      title: "Product Manager",
      department: "Product",
      location: "remote",
      location_details: "US/Europe timezone preferred",
      type: "full-time",
      description:
        "Lead product development for our DeFi trading platform. You'll work closely with engineering, design, and business teams to define and execute the product roadmap.",
      requirements: [
        "4+ years of product management experience",
        "Background in fintech or DeFi",
        "Strong analytical and communication skills",
        "Experience with agile methodologies",
        "Crypto/trading experience preferred",
      ],
      benefits: [
        "Competitive salary + equity",
        "Remote-first culture",
        "Unlimited PTO",
        "Health & wellness benefits",
      ],
      salary_range: "$130,000 - $170,000",
      status: "active",
      created_at: "2025-12-05T00:00:00Z",
    },
    {
      id: "4",
      title: "DevOps Engineer",
      department: "Engineering",
      location: "remote",
      location_details: "Worldwide",
      type: "full-time",
      description:
        "Build and maintain our cloud infrastructure and CI/CD pipelines. You'll ensure high availability and security of our trading platform while optimizing for performance and cost.",
      requirements: [
        "3+ years of DevOps/SRE experience",
        "Expertise in AWS/GCP/Azure",
        "Experience with Kubernetes and Docker",
        "Infrastructure as Code (Terraform, Pulumi)",
        "Monitoring and observability tools",
      ],
      benefits: [
        "Competitive salary + equity",
        "Remote-first culture",
        "On-call compensation",
        "Equipment allowance",
      ],
      salary_range: "$110,000 - $160,000",
      status: "active",
      created_at: "2025-12-01T00:00:00Z",
    },
    {
      id: "5",
      title: "UI/UX Designer",
      department: "Design",
      location: "remote",
      location_details: "Worldwide",
      type: "full-time",
      description:
        "Create beautiful and intuitive designs for our trading platform. You'll work on everything from user research to high-fidelity prototypes, ensuring a world-class user experience.",
      requirements: [
        "4+ years of product design experience",
        "Proficiency in Figma and design systems",
        "Experience designing complex data-driven interfaces",
        "Understanding of accessibility standards",
        "Fintech/trading experience is a plus",
      ],
      benefits: [
        "Competitive salary + equity",
        "Remote-first culture",
        "Design tool subscriptions",
        "Creative sabbatical program",
      ],
      salary_range: "$100,000 - $150,000",
      status: "active",
      created_at: "2025-11-28T00:00:00Z",
    },
    {
      id: "6",
      title: "Community Manager",
      department: "Marketing",
      location: "remote",
      location_details: "Worldwide",
      type: "full-time",
      description:
        "Grow and engage our community across Discord, Twitter, and other platforms. You'll be the voice of DOTMX and help build a passionate community of traders and DeFi enthusiasts.",
      requirements: [
        "2+ years of community management experience",
        "Deep understanding of crypto/DeFi culture",
        "Excellent written communication skills",
        "Experience with Discord, Twitter, Telegram",
        "Content creation abilities",
      ],
      benefits: [
        "Competitive salary + equity",
        "Remote-first culture",
        "Flexible schedule",
        "Event attendance opportunities",
      ],
      salary_range: "$70,000 - $100,000",
      status: "active",
      created_at: "2025-11-25T00:00:00Z",
    },
  ];
}
