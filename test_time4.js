const tests = [
  "14:35:22",
  "14.35", // this should only match if prefixed by time or has am/pm
  "Time 14.35",
  "02:30 PM",
  "2:30PM",
  "Time: 12:45 pm",
  "Time 12.45pm",
  "12-10-2024", // this should not match as time
  "12-10",      // this should not match as time
  "14;35"
];
for (const t of tests) {
  const timeMatch = t.match(/(?:Time|At)[\s:.-]*(\d{1,2})[:.;,|-](\d{2})(?:[:.;,|-]\d{2})?(?:\s*(AM|PM|am|pm))?/i) || 
                    t.match(/(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM|am|pm))?/i) ||
                    t.match(/(\d{1,2})[:.;,|-](\d{2})(?:[:.;,|-]\d{2})?\s*(AM|PM|am|pm)/i) ||
                    t.match(/(\d{1,2});(\d{2})(?:;\d{2})?(?:\s*(AM|PM|am|pm))?/i);
  if(timeMatch) {
    console.log(t, "=>", timeMatch[1], timeMatch[2], timeMatch[3]);
  } else {
    console.log(t, "=> null");
  }
}
