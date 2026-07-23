const tests = [
  "05-08-2024",
  "05/08/2024",
  "05.08.2024",
  "5 Aug 2024",
  "Aug 5 2024",
  "2024-08-05",
  "12-10-2024",
  "05/08/24"
];

for (const t of tests) {
  const dateMatch = t.match(/(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{2,4})/) || 
                    t.match(/(\d{1,2})[\s/.-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]*(\d{2,4})/i) || 
                    t.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]+(\d{1,2})[\s,.-]+(\d{2,4})/i);
  if(dateMatch) {
    console.log(t, "=>", dateMatch[0]);
  } else {
    console.log(t, "=> null");
  }
}
