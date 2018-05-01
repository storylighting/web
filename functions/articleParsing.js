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

/**
 * Tone Analysis to convert from information about tones into paragraph level analysis for conversion into
 *
 * @param {Array<Array<Array<Object>>>} tones An array representing the
 *     paragraphs of the main body of the article. This array further contains
 *     an array representing the sentences of each paragraph represented.
 *     Lastly an array of objects representing each of the tones found in the
 *     article. All reported tones have a score of at least 0.5; those with a
 *     score of at least 0.75 are very likely to be perceived in the content.
 *     The object consists of the following properties:
 *         - tone_id {String} The unique, non-localized identifier of the
 *               tone. for descriptions of the tones, see [General purpose tones](https://console.bluemix.net/docs/services/tone-analyzer/using-tone.html#tones).
 *         - tone_name {String} The user-visible, localized name of the tone.
 *         - score {Number} The score for the tone in the range of 0.5 to 1. A
 *               score greater than 0.75 indicates a high likelihood that the
 *               tone is perceived in the content.
 * @returns {Array<Object>} An array of objects representing data corresponding
 *     to the paragraphs of the main body of the article. The object consists
 *     of the following properties:
 *         - joy {Number} The normalised value for the paragraph sentiment
 *               spectrum for Joy and Sadness tones ranging between 1 and -1
 *               respectively. The result for all the tones in a given
 *               paragraph is averaged for normalised tone, sentences without
 *               tones are ignored.
 *         - anger {Number} The normalised value for the paragraph sentiment
 *               spectrum for Anger and Fear tones ranging between 1 and -1
 *               respectively. The result for all the tones in a given
 *               paragraph is averaged for normalised tone, sentences without
 *               tones are ignored.
 *         - level {Number} The normalised value for the paragraph sentiment
 *               spectrum for Confident and Tentative tones ranging between 1
 *               and -1 respectively. The result for all the tones in a given
 *               paragraph is averaged for normalised tone, sentences without
 *               tones are ignored.
 */
exports.toneAnalysis = function(tones){
  let paragraphsTones = []
  // Loop over paragraph data
  for (var i = 0; i <= tones.length - 1; i++) {
    let paragraphTones = {
      joy: [],
      anger: [],
      level: []
    };
    // Loop over sentence data
    for (var j = 0; j <= tones[i].length - 1; j++) {
      if (tones[i][j].length > 0 ){
        // Loop over tones data
        for (var k = 0; k <= tones[i][j].length - 1; k++) {
          let tone = tones[i][j][k];

          /* Joy - Sadness Spectrum
           * A spectrum is defined for Joy and Sadness tones ranging between 1
           * and -1 respectively. The result for all the tones in a given
           * paragraph is averaged for normalised tone.
           */
          if (tone.tone_id == "joy"){
            paragraphTones.joy.push(tone.score);
          }
          if (tone.tone_id == "sadness"){
            paragraphTones.joy.push(-tone.score);
          }

          /* Anger - Fear Spectrum
           * A spectrum is defined for Anger and Fear tones ranging between 1
           * and -1 respectively. The result for all the tones in a given
           * paragraph is averaged for normalised tone.
           */
          if (tone.tone_id == "anger"){
            paragraphTones.anger.push(tone.score);
          }
          if (tone.tone_id == "fear"){
            paragraphTones.anger.push(-tone.score);
          }

          /* Confident - Tentative Spectrum
           * A spectrum is defined for Confident and Tentative tones ranging between 1
           * and -1 respectively. The result for all the tones in a given
           * paragraph is averaged for normalised tone.
           */
          if (tone.tone_id == "confident"){
            paragraphTones.level.push(tone.score);
          }
          if (tone.tone_id == "tentative"){
            paragraphTones.level.push(-tone.score);
          }
        }
      }
    }

    /* Average spectrums to obtain a point in 3D space constrained to a cube with
     * extents 1,1,1 and -1,-1,-1 to convert into a color
     */
    if (paragraphTones.joy.length > 0){
      paragraphTones.joy = paragraphTones.joy.reduce((a, b) => a + b, 0) / paragraphTones.joy.length;
    } else {
      paragraphTones.joy = 0;
    }
    if (paragraphTones.anger.length > 0){
      paragraphTones.anger = paragraphTones.anger.reduce((a, b) => a + b, 0) / paragraphTones.anger.length;
    } else {
      paragraphTones.anger = 0;
    }
    if (paragraphTones.level.length > 0){
      paragraphTones.level = paragraphTones.level.reduce((a, b) => a + b, 0) / paragraphTones.level.length;
    } else {
      paragraphTones.level = 0;
    }
    paragraphsTones.push(paragraphTones);
  }
  return paragraphsTones;
}
