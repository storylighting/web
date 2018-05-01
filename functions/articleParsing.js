var rp = require('request-promise');

/**
 * A helper to assist in using Dandelion's Entity Extraction API, using
 * semantic text analytics to find places, people, brands, and events in the
 * provided text.
 *
 * @param text {String} The string to parse
 * @returns {Object}
 */
exports.entityRecognition = function (text){
  return rp({ method: 'POST', uri: 'https://api.dandelion.eu/datatxt/nex/v1',
    form: {
        text: text,
        top_entities: 3,
        include: 'types,abstract,image',
        token: '**REMOVED**',
    },
    json: true // Automatically stringifies the body to JSON
  });
}

/**
 * A helper to assist in using IBM Watson's Tone Analyzer API to understand
 * emotions, social tendencies and perceived writing style in the provided
 * text.
 *
 * @param text {String} The string to parse
 * @returns {Object}
 */
exports.toneAnalyzer = function (text){
  return rp({ method: 'POST', uri: 'https://gateway.watsonplatform.net/tone-analyzer/api/v3/tone?version=2017-09-21',
    auth: {
      user: '**REMOVED**',
      pass: '**REMOVED**'
    },
    body: {
        text: text,
    },
    headers: {
      'content-type': 'application/json'
    },
    json: true // Automatically stringifies the body to JSON
  });
}

/**
 * Add color droplets and markup to the article's paragraph elements allowing
 * the individual paragraphs to be color editable and detected for queuing
 * purposes.
 *
 * @param {Array<String>} paragraphs An array of unicode strings representing
 *     the paragraphs of the main body of the article. Used to verify marking
 *     up paragraphs according to determined order.
 * @return {Array<HTMLElement>} An array of `HTMLElement`s representing the
 *     paragraph elements to watch.
 */
exports.metaMarkUpArticleParagraphs = function (paragraphs){

  let paragraphsData = [[],];

  // Request from Watson
  return exports.toneAnalyzer(paragraphs.join('\n')).then(function (tones) {
    let documentTones = tones.document_tone;
    let sentenceTones = tones.sentences_tone;

    // Return Sentences to Paragraph Level
    for (let i = 0, j = 0, max = sentenceTones.length; i < max;) {
      // Check if Sentence Belongs to Paragraph
      if (paragraphs[j].indexOf(sentenceTones[i].text) > -1){
        paragraphsData[j].push(sentenceTones[i].tones);
        i++;  // Proceed to Next Sentence
      }else {
        j++;  // Attempt Next Paragraph

        // Initalise Next Pargraph Data Structure
        paragraphsData[j] = [];
      }
    }
    return paragraphsData;
  });
}
