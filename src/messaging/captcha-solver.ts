import {config} from '../config';
import {logger} from '../logger';
import {DMPayload} from '.';

import * as fs from 'fs';
const fetch = require('node-fetch');
const sharp = require('sharp');
const tesseract = require('node-tesseract-ocr');

const DEBUG_LETTERS = false;
const DEBUG_CAPTCHA = false;

const tesseractConfig = {
  lang: 'eng',
  oem: 1,
  psm: 10, // 10  	Treat the image as a single character
  tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ',
  //tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  // dpi: 300,
};

const BLACK_THRESHOLD = 240;

interface Histogram {
  row: number;
  count: number;
}

export async function getWithCaptchaSolver(
  payload: DMPayload,
  timeout?: number
): Promise<string> {
  logger.info('↗ using captcha solver');

  var response = '';
  try {
    let buffer;
    if (payload.type === 'text') {
      buffer = await downloadImage(payload.content);
    } else {
      buffer = payload.content;
    }

    response = await processCaptcha(buffer);
  } catch (error) {
    logger.error(error);
  }

  return response;
}

async function downloadImage(url: string) {
  logger.info('↗ downloading captcha');
  const response = await fetch(url);
  const buffer = await response.buffer();
  return buffer;
}

function debugOutput(
  startx: number,
  width: number,
  height: number,
  pixelCoordinateArray: any
) {
  for (let x = 0; x < height; x++) {
    let line = '';
    for (let y = startx; y < width; y++) {
      line += pixelCoordinateArray[x][y] < 255 ? 'X' : ' ';
    }
    console.log(line);
  }
}

function debugSave(inputBuffer: string, outputFile: string) {
  fs.writeFileSync(outputFile, inputBuffer);
}

async function processCaptcha(inputBuffer: string): Promise<string> {
  logger.info('↗ solving captcha...');

  const image = await sharp(inputBuffer)
    .normalise()
    .grayscale()
    .threshold(BLACK_THRESHOLD)
    .raw()
    .toBuffer({resolveWithObject: true});

  const data = image.data;
  const info = image.info;

  const pixelArray = new Uint8ClampedArray(data.buffer);
  const {width, height, channels} = info;

  // Populate x,y array
  var pixelCoordinateArray = [];
  for (let i = 0, j = pixelArray.length; i < j; i += width) {
    let line = pixelArray.slice(i, i + width);
    pixelCoordinateArray.push(line);
  }

  // find first row with black pixels
  var firstRow = width;
  for (let x = 0; x < height; x++) {
    for (let y = 0; y < width; y++) {
      if (pixelCoordinateArray[x][y] != 255) {
        firstRow = y < firstRow ? y : firstRow;
      }
    }
  }

  // Debug print
  // debugOutput(firstRow, width, height - 25, pixelCoordinateArray);

  // Cut letters
  const MINIMUM_LETTER_LENGTH = 14;
  const MAXIMUM_LETTER_LENGTH = 33;

  var letterBoxes = [];

  var startRow = firstRow;
  var endRow = firstRow;
  // Create a histogram for each letter and find "best" candidate
  for (let splitIndex = 0; splitIndex < 6; splitIndex++) {
    let histogram: Histogram[] = [];
    let letterStart = startRow + MINIMUM_LETTER_LENGTH;
    let letterEnd = startRow + MINIMUM_LETTER_LENGTH + MAXIMUM_LETTER_LENGTH;
    for (let y = letterStart; y < letterEnd; y++) {
      let rowPixelCounter = 0;
      for (let x = 0; x < height; x++) {
        if (pixelCoordinateArray[x][y] < 255) {
          rowPixelCounter++;
        }
      }

      let rowHistogram: Histogram = {
        row: y,
        count: rowPixelCounter,
      };
      histogram.push(rowHistogram);
    }

    // Sort and limit histogram
    histogram.sort((h1: Histogram, h2: Histogram) => {
      return h1.count - h2.count;
    });
    histogram = histogram.slice(0, 1);
    endRow = histogram[0].row - startRow;

    // final coordinates
    // logger.debug({left: startRow, top: 0, width: endRow, height: height});
    letterBoxes.push({left: startRow, top: 0, width: endRow, height: height});

    // update start for next letter
    startRow = startRow + endRow;
  }

  // Debug output with letter box drawn
  for (let x = 0; x < height; x++) {
    let line = '';
    for (let y = 0; y < width; y++) {
      pixelCoordinateArray[x][y] = 0;
    }
  }

  var letters: string[] = [];
  var captchaResult: string = '';

  var tries: number = 0;

  // try some rotations to find a match for 6 letters
  while (tries < 12) {
    for (let letterIndex = 0; letterIndex < 6; letterIndex++) {
      let startRotation = 14;
      let rotation = startRotation + tries * 2;

      // Rotate letter
      let rotateAngle = letterIndex % 2 == 0 ? rotation * -1 : rotation;

      // load captcha input from memory and extract the letter
      let letterBuffer: Buffer = await sharp(pixelArray, {
        raw: {
          width: width,
          height: height,
          channels: channels,
        },
      })
        .normalise()
        .grayscale()
        .threshold(BLACK_THRESHOLD)
        .extract(letterBoxes[letterIndex])
        .rotate(rotateAngle, {
          background: 'white',
        })
        .png()
        .toBuffer();

      // OCR on letter buffer
      await tesseract
        .recognize(letterBuffer, tesseractConfig)
        .then((text: string) => {
          let ocrResult = text.trim();
          if (ocrResult.length != 0) {
            letters.push(ocrResult);
          } else {
            letters.push('_');
            if (DEBUG_LETTERS) {
              let outfile = `./unrecognized--${Date.now()}.png`;
              fs.writeFileSync(outfile, letterBuffer);
            }
          }
        })
        .catch((error: Error) => {
          logger.error(`Error: ${error.message}`);
        });
    }

    captchaResult = letters.join('');
    let charCount = letters.filter(letter => letter !== '_').length;
    if (charCount != 6) {
      logger.info(
        `✖ captcha returned ${captchaResult} (length: ${charCount} characters, most likely incorrect)`
      );
      letters = [];
    } else {
      // Solution success
      logger.info(`✔ captcha solved: ${captchaResult}`);
      break;
    }
    tries++;
  }

  if (DEBUG_CAPTCHA) {
    let outfile = `./unrecognized-captcha-${Date.now()}.png`;
    fs.writeFileSync(outfile, inputBuffer);
  }

  logger.info(`↗ using captcha-solver result ${captchaResult}`);

  return captchaResult;
}
