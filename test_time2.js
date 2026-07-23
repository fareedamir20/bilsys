const tests = [
  "14:35:22",
  "14.35",
  "02:30 PM",
  "2:30PM",
  "Time: 12:45 pm",
  "Time 12.45pm",
  "12-10"
];
for (const t of tests) {
  const timeMatch = t.match(/(\d{1,2})[:.;,|-](\d{2})(?:[:.;,|-]\d{2})?(?:\s*(AM|PM|am|pm))?/i);
  console.log(t, "=>", timeMatch ? timeMatch[0] : null);
}
