#!/usr/bin/env tsx

import { main } from "../src/main.js";

// Run the main function
main().catch((error) => {
  console.error("Unhandled error in main:", error);
  process.exit(1);
});
