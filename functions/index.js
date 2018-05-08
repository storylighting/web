const functions = require('firebase-functions');
var articleParsing = require('./articleParsing');

exports.makeArticleParagraphColors = functions.firestore.document('articles/{id}').onCreate((snapshot, context) => {
  // Grab the current value of what was written to the Realtime Database.
  const article = snapshot.data();
  let paragraphs = article.paragraphs;
  return articleParsing.articleSentenceToneAnalyzer(paragraphs)
    .then(articleParsing.toneAnalysis)
    .then(articleParsing.toneToColor)
    .then(data => {
      return snapshot.ref.set({
        colors: data
      }, {merge: true});
    })
    .catch(err => {
      console.log('failed\n', err);
    });
});
