#!/usr/bin/env bun
/**
 * Generate OpenAPI Specification
 * 
 * This script generates the OpenAPI/Swagger specification for the DotMX API
 * and saves it to a JSON file.
 */

import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { createApiApp } from "../packages/api/src/index";
import { createGatewayAdapter, createMemoryCommandBus, createShardRouter } from "../packages/gateway/src/index";
import * as fs from "fs";
import * as path from "path";

async function generateOpenAPISpec() {
  console.log("🔧 Generating OpenAPI specification...");

  // Initialize minimal dependencies for spec generation
  const commandBus = createMemoryCommandBus();
  const router = createShardRouter({ numShards: 1, virtualNodes: 10 });
  const gateway = createGatewayAdapter(commandBus, router);

  // Create app with Swagger
  const app = createApiApp(gateway);

  // Access the OpenAPI spec
  // Elysia with Swagger exposes the spec at /swagger/json
  const port = 9999; // Temporary port for spec generation
  const server = app.listen({ port, hostname: "127.0.0.1" });

  // Give server a moment to start
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Fetch the OpenAPI spec
    const response = await fetch(`http://127.0.0.1:${port}/swagger/json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
    }

    const spec = await response.json();

    // Write to file
    const outputDir = path.join(process.cwd(), "docs");
    const outputFile = path.join(outputDir, "openapi.json");

    // Ensure docs directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));

    console.log(`✅ OpenAPI specification generated: ${outputFile}`);
    console.log(`📖 View interactive docs at: http://localhost:3000/swagger`);
    console.log(`📄 JSON spec available at: http://localhost:3000/swagger/json`);

    // Also generate YAML version
    const yamlFile = path.join(outputDir, "openapi.yaml");
    const yaml = convertToYAML(spec);
    fs.writeFileSync(yamlFile, yaml);
    console.log(`✅ YAML specification generated: ${yamlFile}`);

  } catch (error) {
    console.error("❌ Failed to generate OpenAPI spec:", error);
    process.exit(1);
  } finally {
    // Cleanup
    server.stop();
    await commandBus.close();
  }
}

/**
 * Simple JSON to YAML converter
 */
function convertToYAML(obj: any, indent = 0): string {
  const spaces = "  ".repeat(indent);
  let yaml = "";

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        yaml += `${spaces}-\n${convertToYAML(item, indent + 1)}`;
      } else {
        yaml += `${spaces}- ${item}\n`;
      }
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += convertToYAML(value, indent + 1);
      } else if (typeof value === "object") {
        yaml += `${spaces}${key}:\n`;
        yaml += convertToYAML(value, indent + 1);
      } else if (typeof value === "string") {
        // Handle multiline strings and special characters
        if (value.includes("\n") || value.includes(":") || value.includes("#")) {
          yaml += `${spaces}${key}: "${value.replace(/"/g, '\\"')}"\n`;
        } else {
          yaml += `${spaces}${key}: ${value}\n`;
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
  } else {
    yaml += `${spaces}${obj}\n`;
  }

  return yaml;
}

// Run the generator
generateOpenAPISpec().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
