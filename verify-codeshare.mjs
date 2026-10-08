// Checks every file from the CodeShare redesign and Hotspots against the reviewed version.
// Run it from the repository root (the folder that contains "client"):
//   node verify-codeshare.mjs
// Whitespace is ignored, so line endings and indentation never cause a false alarm.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const EXPECTED = {
  "client/app/dashboard/page.tsx": "dda623792b79",
  "client/app/error.tsx": "740d35bbaabd",
  "client/app/globals.css": "84840910c5ac",
  "client/app/interviews/[id]/page.tsx": "78e893a8b6ce",
  "client/app/interviews/join/[code]/page.tsx": "b121e80a0a48",
  "client/app/interviews/new/page.tsx": "f48a09884d9b",
  "client/app/interviews/page.tsx": "17b568f5f90b",
  "client/app/layout.tsx": "a2616e3db756",
  "client/app/lens/page.tsx": "8acc9a9ed419",
  "client/app/onboarding/page.tsx": "00f01f859f54",
  "client/app/page.tsx": "bf0193a14693",
  "client/app/practice/[slug]/page.tsx": "1921eb2f56d9",
  "client/app/practice/page.tsx": "519af80b027a",
  "client/app/profile/page.tsx": "a93eab4a558c",
  "client/app/room/[id]/page.tsx": "3df0c08e2022",
  "client/app/sign-in/[[...sign-in]]/page.tsx": "351678cd4612",
  "client/app/sign-up/[[...sign-up]]/page.tsx": "0f2ac0802cef",
  "client/components/AccountMenu.tsx": "4dea5c668fe7",
  "client/components/AppShell.tsx": "e0e9aaa0157f",
  "client/components/AuthShell.tsx": "c22603255048",
  "client/components/AvatarPicker.tsx": "277e70e46101",
  "client/components/ChatPanel.tsx": "34ad7d0caa9a",
  "client/components/CodeEditor.tsx": "0b8fc3d42825",
  "client/components/CommandPalette.tsx": "0faac104334f",
  "client/components/ComplexityMeter.tsx": "42abe0b00c64",
  "client/components/CreateRoomModal.tsx": "000674ade3a5",
  "client/components/DashboardSkeleton.tsx": "e48177fb109b",
  "client/components/DashboardSummary.tsx": "b5976fe1e294",
  "client/components/DifficultyBadge.tsx": "f22a4876235b",
  "client/components/EditorThemePicker.tsx": "dfdb11b1718e",
  "client/components/LanguageDropdown.tsx": "beb50c0b3819",
  "client/components/LiveDemoPreview.tsx": "001ff1551ff6",
  "client/components/Menu.tsx": "3263444827cc",
  "client/components/Navbar.tsx": "011a3303c9b0",
  "client/components/NavigationProgress.tsx": "c9346b78044a",
  "client/components/PageHeader.tsx": "8d0f5cd5d7bf",
  "client/components/PeoplePanel.tsx": "d2cf83093de1",
  "client/components/ProblemPanel.tsx": "33cb1e07d7c8",
  "client/components/ProblemStatement.tsx": "810c471a04bc",
  "client/components/ProfilePreviewCard.tsx": "0de9f465e458",
  "client/components/RoomRow.tsx": "e741bd2c98ef",
  "client/components/RoomSettingsModal.tsx": "67a042864da7",
  "client/components/RoomSkeleton.tsx": "d82fc249c875",
  "client/components/RunPanel.tsx": "a19641a64177",
  "client/components/Segmented.tsx": "66c1e80b9f18",
  "client/components/ShareDialog.tsx": "637e44c1666e",
  "client/components/ShortcutsDialog.tsx": "bf81159d0453",
  "client/components/SiteChrome.tsx": "701259a31557",
  "client/components/ThemeSwitcher.tsx": "0f29e4fccc7f",
  "client/components/ThemedAuth.tsx": "3404885f937d",
  "client/components/ToastProvider.tsx": "8d57f6ed6c3d",
  "client/components/UsernameInput.tsx": "1e7c0de33f6a",
  "client/components/hotspots/HotspotsBar.tsx": "f7da63733dec",
  "client/components/hotspots/HotspotsLane.tsx": "66d41f6c0548",
  "client/components/hotspots/hotspots.css": "8e3c44dfaf00",
  "client/components/hotspots/useEditorHeat.ts": "0c03bdee53a9",
  "client/components/interview/InterviewBar.tsx": "7d16c8e3bc47",
  "client/components/interview/InterviewList.tsx": "fa637b112bfe",
  "client/components/interview/InterviewLobby.tsx": "2ae7bebe3e15",
  "client/components/interview/InterviewOverlays.tsx": "6d17fd502af1",
  "client/components/interview/InterviewRow.tsx": "36eb2cd11e39",
  "client/components/interview/InterviewSetup.tsx": "1ce74e104fd1",
  "client/components/interview/InterviewerPanel.tsx": "9e97bbc381ba",
  "client/components/interview/Scorecard.tsx": "549fb259da54",
  "client/components/landing/AuthCta.tsx": "aaa048f6150a",
  "client/components/landing/FeatureVisuals.tsx": "eed5abe0ffe7",
  "client/components/landing/FinalCta.tsx": "a4dcb94c3654",
  "client/components/landing/Hero.tsx": "4b2a3f541107",
  "client/components/landing/HeroMockup.tsx": "fd347b676ec7",
  "client/components/landing/LensDemo.tsx": "ecf4ad6098fa",
  "client/components/landing/SpotlightCard.tsx": "ee3a9b3bb680",
  "client/components/landing/Tour.tsx": "10757cf9ea3f",
  "client/components/landing/TourVisuals.tsx": "c60ee240da61",
  "client/components/lens/LensCallCard.tsx": "3ec9ac5c63bb",
  "client/components/lens/LensMemory.tsx": "507480d7eaa8",
  "client/components/lens/LensPlayer.tsx": "a26289d5b947",
  "client/components/lens/LensTestPicker.tsx": "edf92e9f6dc8",
  "client/components/lens/RoomLens.tsx": "3e90b2a49f61",
  "client/lib/editorTheme.ts": "63de567123b9",
  "client/lib/execution.ts": "10a9d9be4f8f",
  "client/lib/hotspots.ts": "4fe840fa902a",
  "client/lib/hotspotsJs.ts": "c76cc209e3d0",
  "client/lib/monaco.ts": "e7cb50f6f148",
  "client/lib/theme.ts": "bf4fd14004d3",
  "client/lib/themeScript.ts": "72095ea24403",
  "client/lib/ui.ts": "37a2442f9676",
  "client/lib/useEditorTheme.ts": "55ab0c9b2d85",
  "client/lib/useEscape.ts": "c89430454e1a",
  "client/lib/useHotspots.ts": "ee4d22c60344",
};

const fingerprint = (text) =>
  createHash("sha256").update(text.replace(/^\uFEFF/, "").replace(/\s+/g, "")).digest("hex").slice(0, 12);

let matching = 0;
const problems = [];
for (const [path, expected] of Object.entries(EXPECTED)) {
  if (!existsSync(path)) problems.push(`missing     ${path}`);
  else if (fingerprint(readFileSync(path, "utf8")) !== expected) problems.push(`different   ${path}`);
  else matching++;
}
if (existsSync("client/components/RoomCard.tsx")) problems.push("delete      client/components/RoomCard.tsx");

console.log(`${matching} of ${Object.keys(EXPECTED).length} files match.`);
if (problems.length) {
  console.log("\nNeeds attention:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Everything matches. Ready to commit.");
}