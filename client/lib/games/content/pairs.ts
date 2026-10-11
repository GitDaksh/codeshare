// Pair Programming's cards: pairs of things that belong together. Every
// card's text is unique, so each card has exactly one partner. Pairs in the
// same group could be confused with each other (push/pop and LIFO/Stack),
// so a game never deals two pairs from one group.

export type PairTopic =
  | "data"
  | "http"
  | "network"
  | "numbers"
  | "javascript"
  | "keywords"
  | "languages"
  | "acronyms"
  | "big-o"
  | "html"
  | "shortcuts"
  | "shell"
  | "git"
  | "regex"
  | "operators"
  | "concepts";

export type PairSide = { text: string; code?: boolean };

export type ConceptPair = {
  id: string;
  group: string;
  topic: PairTopic;
  a: PairSide;
  b: PairSide;
};

const c = (text: string): PairSide => ({ text, code: true });
const w = (text: string): PairSide => ({ text });

export const PAIRS: ConceptPair[] = [
  // Data structures
  { id: "lifo", group: "stack", topic: "data", a: w("LIFO"), b: w("Stack") },
  { id: "push-pop", group: "stack", topic: "keywords", a: c("push()"), b: c("pop()") },
  { id: "fifo", group: "queue", topic: "data", a: w("FIFO"), b: w("Queue") },
  { id: "enqueue", group: "queue", topic: "keywords", a: c("enqueue"), b: c("dequeue") },
  { id: "boolean", group: "boolean", topic: "data", a: w("Boolean"), b: c("true / false") },
  { id: "json", group: "json", topic: "data", a: w("JSON"), b: c('{ "a": 1 }') },
  // HTTP
  { id: "http-200", group: "http-200", topic: "http", a: c("200"), b: w("OK") },
  { id: "http-404", group: "http-404", topic: "http", a: c("404"), b: w("Not Found") },
  { id: "http-500", group: "http-500", topic: "http", a: c("500"), b: w("Server Error") },
  { id: "http-401", group: "http-401", topic: "http", a: c("401"), b: w("Unauthorized") },
  // Networking
  { id: "port-443", group: "port-443", topic: "network", a: w("Port 443"), b: w("HTTPS") },
  { id: "port-22", group: "port-22", topic: "network", a: w("Port 22"), b: w("SSH") },
  { id: "localhost", group: "localhost", topic: "network", a: c("localhost"), b: c("127.0.0.1") },
  { id: "dns", group: "dns", topic: "network", a: w("DNS"), b: w("Names → IPs") },
  // Numbers
  { id: "byte", group: "byte", topic: "numbers", a: w("1 byte"), b: w("8 bits") },
  { id: "hex", group: "hex", topic: "numbers", a: c("0xFF"), b: c("255") },
  { id: "binary", group: "binary", topic: "numbers", a: c("0b1010"), b: c("10") },
  { id: "kibi", group: "kibi", topic: "numbers", a: c("2¹⁰"), b: c("1024") },
  // JavaScript
  { id: "nan", group: "nan", topic: "javascript", a: c("NaN"), b: w("Not a Number") },
  { id: "float", group: "float", topic: "javascript", a: c("0.1 + 0.2"), b: c("0.30000000000000004") },
  { id: "concat", group: "concat", topic: "javascript", a: c('"5" + 3'), b: c('"53"') },
  { id: "typeof-null", group: "typeof-null", topic: "javascript", a: c("typeof null"), b: c('"object"') },
  { id: "strict", group: "strict", topic: "javascript", a: c("==="), b: w("Strict equality") },
  { id: "const", group: "const", topic: "javascript", a: c("const"), b: w("Can't be reassigned") },
  // Keywords that come in pairs
  { id: "try", group: "try", topic: "keywords", a: c("try"), b: c("catch") },
  { id: "async", group: "async", topic: "keywords", a: c("async"), b: c("await") },
  { id: "malloc", group: "malloc", topic: "keywords", a: c("malloc()"), b: c("free()") },
  { id: "encode", group: "encode", topic: "keywords", a: c("encode()"), b: c("decode()") },
  // How languages say "function"
  { id: "python-def", group: "python-def", topic: "languages", a: w("Python"), b: c("def") },
  { id: "rust-fn", group: "rust-fn", topic: "languages", a: w("Rust"), b: c("fn") },
  { id: "go-func", group: "go-func", topic: "languages", a: w("Go"), b: c("func") },
  { id: "kotlin-fun", group: "kotlin-fun", topic: "languages", a: w("Kotlin"), b: c("fun") },
  // Acronyms
  { id: "dry", group: "dry", topic: "acronyms", a: w("DRY"), b: w("Don't Repeat Yourself") },
  { id: "crud", group: "crud", topic: "acronyms", a: w("CRUD"), b: w("Create, Read, Update, Delete") },
  { id: "ram", group: "ram", topic: "acronyms", a: w("RAM"), b: w("Random Access Memory") },
  { id: "sql", group: "sql", topic: "acronyms", a: w("SQL"), b: w("Structured Query Language") },
  // Big-O
  { id: "binary-search", group: "binary-search", topic: "big-o", a: w("Binary search"), b: c("O(log n)") },
  { id: "hash-lookup", group: "hash-lookup", topic: "big-o", a: w("Hash map lookup"), b: c("O(1)") },
  { id: "merge-sort", group: "merge-sort", topic: "big-o", a: w("Merge sort"), b: c("O(n log n)") },
  { id: "bubble-sort", group: "bubble-sort", topic: "big-o", a: w("Bubble sort"), b: c("O(n²)") },
  // HTML
  { id: "anchor", group: "anchor", topic: "html", a: c("<a>"), b: w("Link") },
  { id: "img", group: "img", topic: "html", a: c("<img>"), b: w("Image") },
  // Shortcuts
  { id: "undo", group: "undo", topic: "shortcuts", a: c("Ctrl + Z"), b: w("Undo") },
  { id: "copy", group: "copy", topic: "shortcuts", a: c("Ctrl + C"), b: w("Copy") },
  // Shell
  { id: "ls", group: "ls", topic: "shell", a: c("ls"), b: w("List files") },
  { id: "cd", group: "cd", topic: "shell", a: c("cd"), b: w("Change directory") },
  { id: "mkdir", group: "mkdir", topic: "shell", a: c("mkdir"), b: w("Make a folder") },
  // Git
  { id: "gitignore", group: "gitignore", topic: "git", a: c(".gitignore"), b: w("Files Git ignores") },
  { id: "git-clone", group: "copy", topic: "git", a: c("git clone"), b: w("Copy a repo") },
  { id: "git-commit", group: "git-commit", topic: "git", a: c("git commit"), b: w("Save a snapshot") },
  { id: "git-push", group: "git-push", topic: "git", a: c("git push"), b: c("git pull") },
  // Regex
  { id: "regex-digit", group: "regex-digit", topic: "regex", a: c("\\d"), b: w("Any digit") },
  { id: "regex-space", group: "regex-space", topic: "regex", a: c("\\s"), b: w("Whitespace") },
  // Operators
  { id: "and", group: "and", topic: "operators", a: c("&&"), b: w("AND") },
  { id: "or", group: "or", topic: "operators", a: c("||"), b: w("OR") },
  { id: "modulo", group: "modulo", topic: "operators", a: c("%"), b: w("Remainder") },
  // Concepts
  { id: "recursion", group: "recursion", topic: "concepts", a: w("Recursion"), b: w("Calls itself") },
  { id: "mutex", group: "mutex", topic: "concepts", a: w("Mutex"), b: w("One thread at a time") },
  { id: "cache", group: "cache", topic: "concepts", a: w("Cache"), b: w("Fast, nearby copy") },
];
