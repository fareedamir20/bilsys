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

for (const text of tests) {
  const dateMatch = text.match(/\b(\d{4})[\s/.-]+(\d{1,2})[\s/.-]+(\d{1,2})\b/) ||
                    text.match(/\b(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{2,4})\b/) || 
                    text.match(/\b(\d{1,2})[\s/.-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]*(\d{2,4})\b/i) || 
                    text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]+(\d{1,2})[\s,.-]+(\d{2,4})\b/i);
  
  if (dateMatch) {
    let year = 2024, month = 1, day = 1;
    if (dateMatch[1] && dateMatch[2] && dateMatch[3] && !isNaN(Number(dateMatch[2]))) {
        let p1 = parseInt(dateMatch[1]);
        let p2 = parseInt(dateMatch[2]);
        let p3 = parseInt(dateMatch[3]);
        if (p1 > 1000) { year = p1; month = p2; day = p3; }
        else if (p3 > 1000) { year = p3; month = p2; day = p1; }
        else { year = 2000 + p3; month = p2; day = p1; }
        if (month > 12) { let tmp = month; month = day; day = tmp; }
    } else {
        const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        let monthStr = "";
        if (isNaN(Number(dateMatch[1]))) {
            monthStr = dateMatch[1].toLowerCase().substring(0, 3);
            day = parseInt(dateMatch[2]);
            year = parseInt(dateMatch[3]);
        } else {
            day = parseInt(dateMatch[1]);
            monthStr = dateMatch[2].toLowerCase().substring(0, 3);
            year = parseInt(dateMatch[3]);
        }
        month = months[monthStr] || 1;
        if (year < 100) year += 2000;
    }
    const extractedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    console.log(text, "=>", dateMatch[0], "=>", extractedDate);
  } else {
    console.log(text, "=> null");
  }
}
