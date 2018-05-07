const functions = require('firebase-functions');
var rp = require('request-promise');
const interpolateArray = require('2d-bicubic-interpolate').default;
const roundTo = require('round-to');
var convert = require('color-convert');


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
        token: functions.config().dandelion.token
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
      user: functions.config().watson.user,
      pass: functions.config().watson.password
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
 * Chunk and re-combine article sentence tone analysis from IBM Watson. This
 * function is required because of anlaysis limits by the API which analyzes
 * the first 1000 sentences for document-level analysis and only the first 100
 * sentences for sentence-level analysis.
 *
 * @param {Number} j Paragraph number, Zero-index based
 * @param {Array<Array<Array<Object>>>} paragraphsData An array representing
 *     the paragraphs of the main body of the article. This array further
 *     contains an array representing the sentences of each paragraph
 *     represented. Lastly an array of objects representing each of the tones
 *     found in the article. All reported tones have a score of at least 0.5;
 *     those with a score of at least 0.75 are very likely to be perceived in
 *     the content. The object consists of the following properties:
 *         - tone_id {String} The unique, non-localized identifier of the
 *               tone. for descriptions of the tones, see [General purpose tones](https://console.bluemix.net/docs/services/tone-analyzer/using-tone.html#tones).
 *         - tone_name {String} The user-visible, localized name of the tone.
 *         - score {Number} The score for the tone in the range of 0.5 to 1. A
 *               score greater than 0.75 indicates a high likelihood that the
 *               tone is perceived in the content.
 * @param {String} paragraphsText A string containing the remainder of the
 *     article yet to analyse.
 * @param {Array<String>} paragraphs An array of unicode strings representing
 *     the paragraphs of the main body of the article. Used to verify marking
 *     up paragraphs according to determined order.
 * @returns {Array<Array<Array<Object>>>} An array representing the paragraphs
 *     of the main body of the article. This array further contains an array
 *     representing the sentences of each paragraph represented. Lastly an
 *     array of objects representing each of the tones found in the article.
 *     All reported tones have a score of at least 0.5; those with a score of
 *     at least 0.75 are very likely to be perceived in the content. The object
 *     consists of the following properties:
 *         - tone_id {String} The unique, non-localized identifier of the
 *               tone. for descriptions of the tones, see [General purpose tones](https://console.bluemix.net/docs/services/tone-analyzer/using-tone.html#tones).
 *         - tone_name {String} The user-visible, localized name of the tone.
 *         - score {Number} The score for the tone in the range of 0.5 to 1. A
 *               score greater than 0.75 indicates a high likelihood that the
 *               tone is perceived in the content.
 */
function articleSentenceToneAnalyzerHelper (j, paragraphsData, paragraphsText, paragraphs){
  return exports.toneAnalyzer(paragraphsText).then(tones => {
    let documentTones = tones.document_tone;
    let sentenceTones = tones.sentences_tone;

    // Return Sentences to Paragraph Level
    for (let i = 0, max = sentenceTones.length; i < max;) {
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

    let lastSentenceAnalysed = sentenceTones[sentenceTones.length-1].text;
    let lastSentenceAnalysedLocation = paragraphsText.indexOf(lastSentenceAnalysed);
    if (lastSentenceAnalysedLocation > -1 & paragraphsText.length > (lastSentenceAnalysedLocation + lastSentenceAnalysed.length)){
      return articleSentenceToneAnalyzerHelper(j, paragraphsData, paragraphsText.substring(lastSentenceAnalysedLocation + lastSentenceAnalysed.length), paragraphs);
    } else {
      return paragraphsData;
    }
  });
}

/**
 * Parse article for sentence level tone information to be used in generating
 * sentiment timeline to create color progression. Primarily a helper function
 * to assist in providing magic initalisations to the
 * `articleSentenceToneAnalyzerHelper`
 *
 * @param {Array<String>} paragraphs An array of unicode strings representing
 *     the paragraphs of the main body of the article. Used to verify marking
 *     up paragraphs according to determined order.
 * @returns {Array<Array<Array<Object>>>} An array representing the paragraphs
 *     of the main body of the article. This array further contains an array
 *     representing the sentences of each paragraph represented. Lastly an
 *     array of objects representing each of the tones found in the article.
 *     All reported tones have a score of at least 0.5; those with a score of
 *     at least 0.75 are very likely to be perceived in the content. The object
 *     consists of the following properties:
 *         - tone_id {String} The unique, non-localized identifier of the
 *               tone. for descriptions of the tones, see [General purpose tones](https://console.bluemix.net/docs/services/tone-analyzer/using-tone.html#tones).
 *         - tone_name {String} The user-visible, localized name of the tone.
 *         - score {Number} The score for the tone in the range of 0.5 to 1. A
 *               score greater than 0.75 indicates a high likelihood that the
 *               tone is perceived in the content.
 */
exports.articleSentenceToneAnalyzer = function (paragraphs){
  // Request from Watson
  return articleSentenceToneAnalyzerHelper(0, [[],], paragraphs.join('\n'), paragraphs);
}

/**
 * Tone Analysis to convert from information about tones into paragraph level
 * analysis for conversion into a cartesian plane and level which will be used
 * to map to final colors displayed by the article.
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
          if (tone.tone_id === "joy"){
            paragraphTones.joy.push(tone.score);
          }
          if (tone.tone_id === "sadness"){
            paragraphTones.joy.push(-tone.score);
          }

          /* Anger - Fear Spectrum
           * A spectrum is defined for Anger and Fear tones ranging between 1
           * and -1 respectively. The result for all the tones in a given
           * paragraph is averaged for normalised tone.
           */
          if (tone.tone_id === "anger"){
            paragraphTones.anger.push(tone.score);
          }
          if (tone.tone_id === "fear"){
            paragraphTones.anger.push(-tone.score);
          }

          /* Confident - Tentative Spectrum
           * A spectrum is defined for Confident and Tentative tones ranging between 1
           * and -1 respectively. The result for all the tones in a given
           * paragraph is averaged for normalised tone.
           */
          if (tone.tone_id === "confident"){
            paragraphTones.level.push(tone.score);
          }
          if (tone.tone_id === "tentative"){
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

/**
 * Color Map
 *
 * @returns {Array<Object>} An array of objects represnting an interpolation
 *     between defined color gradients. The object consists of the following
 *     properties:
 *         - x {Number} The beginning coordinate of the Joy-Sadness axis for a
 *               given interpolation square of width .1
 *         - y {Number} The beginning coordinate of the Anger-Fear axis for a
 *               given interpolation square of width .1
 *         - c {Array<Number>} The color based on a 2D bicubic interpolation of
 *               the color gradient by seperating the red green and blue
 *               channels of the color. The color is stored in an array of
 *               length 3 and of the form [RR, GG, BB] where where RR (red), GG
 *               (green) and BB (blue) are integers from 0 to 255 representing
 *               the color.
 */
exports.emotionalColorGradientMap = function(){
  // Defined Coordinates
  // ( joy, anger ) = #COLOR
  // ( 0, 1) = #FF0000 (255,   0,   0) Red
  // ( 0,-1) = #FFFFFF (255, 255, 255) White
  // ( 1, 0) = #FBB03B (251, 176,  59) Orange
  // (-1, 0) = #29ABE2 ( 41, 171, 226) Blue

  const redChannels = [
    {
      x: 0,
      y: 0,
      z: 255 // #FFFFFF (255, 255, 255) White
    },
    {
      x: 0,
      y: 1,
      z: 41  // #29ABE2 ( 41, 171, 226) Blue
    },
    {
      x: 1,
      y: 0,
      z: 251 // #FBB03B (251, 176,  59) Orange
    },
    {
      x: 1,
      y: 1,
      z: 255 // #FF0000 (255,   0,   0) Red
    }
  ];
  const greenChannels = [
    {
      x: 0,
      y: 0,
      z: 255 // #FFFFFF (255, 255, 255) White
    },
    {
      x: 0,
      y: 1,
      z: 171 // #29ABE2 ( 41, 171, 226) Blue
    },
    {
      x: 1,
      y: 0,
      z: 176 // #FBB03B (251, 176,  59) Orange
    },
    {
      x: 1,
      y: 1,
      z: 0   // #FF0000 (255,   0,   0) Red
    }
  ];
  const blueChannels = [
    {
      x: 0,
      y: 0,
      z: 255 // #FFFFFF (255, 255, 255) White
    },
    {
      x: 0,
      y: 1,
      z: 226 // #29ABE2 ( 41, 171, 226) Blue
    },
    {
      x: 1,
      y: 0,
      z: 59  // #FBB03B (251, 176,  59) Orange
    },
    {
      x: 1,
      y: 1,
      z: 0   // #FF0000 (255,   0,   0) Red
    }
  ];
  let n = 10;
  let reds = interpolateArray(redChannels, n-1);
  let greens = interpolateArray(greenChannels, n-1);
  let blues = interpolateArray(blueChannels, n-1);

  return reds.map((elem, i) => {
    return {x: roundTo(elem.x, 1), y: roundTo(elem.y, 1), c: [roundTo(elem.z, 0), roundTo(greens[i].z, 0), roundTo(blues[i].z, 0)]};
  })
}

/**
 * Color mapping of a given cartesian values to an emotional color and
 * brightness value.
 *
 * @param {Array<Object>} emotions An array of objects representing data
 *     corresponding to the paragraphs of the main body of the article. The
 *     object consists of the following properties:
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
 * @returns {Array<Object>} An array of objects representing colors
 *     corresponding to the paragraphs of the main body of the article. The
 *     object consists of the following propeties:
 *         - hex {String} An hexadecimal color specified with: #RRGGBB, where
 *               RR (red), GG (green) and BB (blue) are hexadecimal integers
 *               between 00 and FF specifying the intensity of the color.
 *         - xy {Object} An object representing the color specified in CIE
 *               color space. All points on this plot have unique xy
 *               coordinates that can be used when setting the color of a hue
 *               bulb. If an xy value outside of bulbs relevant Gamut triangle
 *               is chosen, it will produce the closest color it can make.
 */
exports.toneToColor = function (coordinates){
  let colorMap = exports.emotionalColorGradientMap();
  return coordinates.map((coordinate, index) => {

    // Transpose Coordinates
    // https://math.stackexchange.com/a/383343
    let x = (coordinate.joy + coordinate.anger);
    let y = (coordinate.anger - coordinate.joy);

    // Transform
    x += 1;
    y += 1;

    // Scale to Fit 1x1 Box
    x = x/2;
    y = y/2;

    // Clip if Outside of Bounding Box
    x = (x < 0) ? 0 : x;
    y = (y < 0) ? 0 : y;

    x = (x > 1) ? 1 : x;
    y = (y > 1) ? 1 : y;

    // Move to Nearest Bucket
    x = roundTo(x, 1);
    y = roundTo(y, 1);

    let color = colorMap.filter(gridElement => gridElement.x === x && gridElement.y === y );
    color = color[0].c; // Select First Element
    let hex = convert.rgb.hex(color);
    let xyz =convert.rgb.xyz(color);
    xyz = xyz.map(val => val/100);
    let xyConversion = xyz.reduce((a,b)=> a+b, 0);

    return {hex: '#'+hex, xy: {x: xyz[0]/xyConversion, y: xyz[1]/xyConversion}};
  });
}
