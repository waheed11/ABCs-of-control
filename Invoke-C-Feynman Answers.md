<%*
  // Define the 12 Feynman Questions
  const feynmanQuestions = [
    "كيف يمكنني أن استحضر نية اخلاص العمل لله وأنه عبادة ارجوا بها ثوابه ورضاه و الجنة في كل عمل اقوم به.", // Corresponds to 1
    "كيف احسن لنفسي ولوالدي ولأسرتي وللآخرين مبتغيا من ذلك وجه الله و ثوابه والدار الآخرة.", // Corresponds to 2
    "كيف اترك ارث علمي يفيد الناس بعد موتي ويكون صدق جارية لي.", // Corresponds to 3
    "كيف اوقف اي افكار و توجهات وسلوكيات تعيق تقدمي او تؤثر علي بشكل سلبي او بشكل لا يتوافق مع قيمي واخلاقي, سواء تلك التي من داخل نفسي او من الخارج.", // Corresponds to 4
    "كيف ابني شبكة علاقات  تساعدني في تحقيق رسالتي و رؤيتي وتكون هذه الشبكة متوافقه مع قيمي.", // Corresponds to 5
    "كيف اطور منتجات وأنظمة تعليم ذاتي محفزة وتخلق فرص للنمو الفكري والمالي.", // Corresponds to 6
    "مالذي يمكن عملة حتى نؤسس أنظمة و منتجات غير مركزية لا تعتمد على شركات ومنظمات معينة.", // Corresponds to 7
    "كيف يمكن تاسيس أنظمة رقمية تعمل بشكل مستقل حتى لو حدثت اضطرابات وكوارث عالمية.", // Corresponds to 8
    "كيف أعمل على اصدار عملة رقمية خاصة تساعد الناس على الاستقلالية المالية." // 
  ];

  // Prepare items for the suggester:
  // displayTexts will show "1. Question text..."
  // questionNumbers will be the actual values returned (1, 2, 3, ...)
  const displayTexts = feynmanQuestions.map((q, index) => `${index + 1}. ${q}`);
  const questionNumbers = feynmanQuestions.map((q, index) => index + 1);

  // Show the suggester to the user for question selection
  const selectedQuestionNumber = await tp.system.suggester(
    displayTexts, 
    questionNumbers, 
    false, // dritten Parameter (throw_on_cancel) auf false setzen, damit bei Abbruch null zurückgegeben wird
    "Select a Feynman question to answer:" // Placeholder-Text für den Suggester
  );

  // Handle cancellation of the question selection
  if (selectedQuestionNumber === null) {
    new Notice("❌ Question selection cancelled.");
    return ""; // Return empty string to prevent inserting "undefined"
  }

  // Get the selected question text using the returned number (1-based index)
  const selectedQuestionText = feynmanQuestions[selectedQuestionNumber - 1];

  // Prompt the user with the actual question before asking for their answer
  const answer = await tp.system.prompt(`Question ${selectedQuestionNumber}: ${selectedQuestionText}\n\nYour answer:`);

  // Handle cancellation or empty answer for the second prompt
  if (answer === null) {
    new Notice("❌ Answer process cancelled.");
    return "";
  }
  if (answer.trim() === "") {
    new Notice("❌ Answer cannot be empty.");
    return "";
  }

  const fileName = "C/Home/اجابات-12.md"; // Ensure this file exists in your vault
  const file = app.vault.getAbstractFileByPath(fileName);

  if (!file) {
    new Notice(`❌ File not found: ${fileName}`);
    return "";
  }

  let content = await app.vault.read(file);
  let lines = content.split('\n');

  // This assumes your headings in "Feynman-12-Questions.md" are exactly "## 1.", "## 2.", etc. (including the period).
  let headingLine = `## ${selectedQuestionNumber}.`;
  let insertIndex = -1;
  let headingFound = false; // Flag to check if the specific heading was found

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === headingLine) {
      headingFound = true;
      insertIndex = i + 1; // Start looking for insertion point *after* the heading line
      
      // Move forward to find the line *before* the next heading or the end of the section.
      while (insertIndex < lines.length && !lines[insertIndex].trim().startsWith("## ")) {
        insertIndex++;
      }
      break; // Exit loop once the correct section's end is found
    }
  }

  if (!headingFound) {
    new Notice(`❌ Heading '${headingLine}' not found in ${fileName}. Ensure headings are formatted exactly like '## 1.', '## 2.', etc., including the period.`);
    return "";
  }

  lines.splice(insertIndex, 0, `- **${answer}**`);

  const newContent = lines.join('\n');
  await app.vault.modify(file, newContent);
  new Notice(`✅ Answer added under '${headingLine}' in ${fileName}`);

  return "";
%>