import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const creatorPath = path.join(root, "src", "data", "creators", "jane-voss.json");
const requiredFields = [
  "slug",
  "displayName",
  "publicEmail",
  "adminEmail",
  "tagline",
  "shortBio",
  "fullBio",
  "aiDisclosure",
  "themes",
  "styleTags",
  "contentPillars",
  "platformPolicy",
  "platforms",
  "links",
  "seoTitle",
  "seoDescription",
  "status",
  "assets",
  "notes"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".netlify") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const creator = JSON.parse(await readFile(creatorPath, "utf8"));
for (const field of requiredFields) {
  assert(Object.hasOwn(creator, field), `Missing creator field: ${field}`);
}

assert(creator.slug === "jane-voss", "Creator slug must be jane-voss");
assert(creator.links.home === "/", "Homepage remains the link-in-bio target");
assert(!existsSync(path.join(root, "jane-voss", "links")), "Do not create /jane-voss/links; homepage is the linktree");

const indexHtml = await readText("index.html");
assert(indexHtml.includes("scrollVideo"), "Homepage scroll video element is missing");
assert(indexHtml.includes("const DESIGNS"), "Homepage design configuration is missing");
assert(indexHtml.includes("Fully AI-generated virtual model"), "Homepage AI disclosure is missing");
assert(!indexHtml.includes("assets are not available"), "Placeholder asset warning must not be visible");
assert(!/18\+|Private Hub|Exclusive|Unlock Access|Members only/i.test(indexHtml), "Public homepage contains non-SFW/private wording");

for (const requiredPage of ["jane-voss/index.html", "jane-voss/disclosure/index.html"]) {
  assert(existsSync(path.join(root, requiredPage)), `Missing static page: ${requiredPage}`);
}

const scanFiles = (await collectFiles(root)).filter((file) => {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  if (rel === "scripts/build-check.mjs") return false;
  if (rel.startsWith("homepage_linkhub_lora_set/")) return false;
  if (rel.startsWith("qa_")) return false;
  return /\.(html|json|js|mjs|md|toml|txt|svg)$/i.test(rel);
});

const secretPattern = /(github_pat_|ghp_|gho_|nfp_|NETLIFY_AUTH_TOKEN=|GITHUB_TOKEN=)/;
for (const file of scanFiles) {
  const text = await readFile(file, "utf8");
  assert(!secretPattern.test(text), `Potential secret found in ${path.relative(root, file)}`);
}

console.log("Static build check passed");
