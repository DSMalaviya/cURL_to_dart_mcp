#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import {
    quicktype,
    InputData,
    jsonInputForTargetLanguage,
} from "quicktype-core";
import { z } from "zod";



// --- Utility: Execute cURL ---
function executeCurl(curlCommand: string): Promise<any> {
    return new Promise((resolve, reject) => {
        exec(
            curlCommand,
            { maxBuffer: 1024 * 1024 * 10 },
            (error, stdout, stderr) => {
                if (error) {
                    reject(stderr || error.message);
                    return;
                }

                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    reject("Response is not valid JSON");
                }
            }
        );
    });
}

// --- Utility: Generate Dart ---
async function generateDartModel(jsonData: any, className: string) {
    const jsonInput = jsonInputForTargetLanguage("dart");

    await jsonInput.addSource({
        name: className,
        samples: [JSON.stringify(jsonData)],
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);

    const result = await quicktype({
        inputData,
        lang: "dart",
        allPropertiesOptional: true,
        rendererOptions: {
            "just-types": "false",
            "required-props": "false",
            "null-safety": "true",
            "final-props": "true",
        },

    });

    return result.lines.join("\n");
}

// --- MCP Server ---
const server = new McpServer({
    name: "curl-to-dart",
    version: "1.0.0",
});

// Register tool
server.registerTool(
    "curl_to_dart",
    {
        title: "cURL to Dart model class",
        description: "Convert a cURL command string to a Dart model class",
        inputSchema: z.object({
            curl: z.string().describe("The cURL command string to parse"),
            className: z.string().optional().describe("The main class name for the generated Dart model")
        })
    },
    async ({ curl, className }) => {
        const json = await executeCurl(curl);
        const dart = await generateDartModel(
            json,
            className || "ApiResponse"
        );

        return {
            content: [
                {
                    type: "text",
                    text: dart,
                },
            ],
        };
    }
);

// Start stdio transport
const transport = new StdioServerTransport();
server.connect(transport);