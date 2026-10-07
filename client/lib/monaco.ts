import { loader } from "@monaco-editor/react";

// The code editor's version, pinned so an update to @monaco-editor/react can
// never quietly switch it. Newer releases (0.57) can start the editor before
// all of its built-in features have loaded, which logs errors and leaves
// those features broken; 0.55.1 is the version the tests run against.
export const MONACO_VERSION = "0.55.1";

loader.config({ paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` } });