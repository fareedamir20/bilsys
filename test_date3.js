const tests = [
  "Aug 5 2024",
];
for (const text of tests) {
  const dateMatch = text.match(/\b(\d{4})[\s/.-]+(\d{1,2})[\s/.-]+(\d{1,2})\b/) ||
                    text.match(/\b(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{2,4})\b/) || 
                    text.match(/\b(\d{1,2})[\s/.-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]*(\d{2,4})\b/i) || 
                    text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]+(\d{1,2})[\s,.-]+(\d{2,4})\b/i);
  console.log(dateMatch);
  
  if (dateMatch) {
    let year = 2024, month = 1, day = 1;
    console.log("dateMatch[1]:", dateMatch[1], "dateMatch[2]:", dateMatch[2], "dateMatch[3]:", dateMatch[3]);
    console.log("isNaN(Number(dateMatch[2])):", isNaN(Number(dateMatch[2])));
    if (dateMatch[1] && dateMatch[2] && dateMatch[3] && !isNaN(Number(dateMatch[2]))) {
        console.log("condition 1");
    } else {
        console.log("condition 2");
    }
  }
}
