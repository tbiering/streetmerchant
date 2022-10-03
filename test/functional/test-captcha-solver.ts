import {handleCaptchaAsync} from '../../src/store/captcha-handler';
import {launchTestBrowser} from '../util';
import {Link, Store} from '../../src/store/model';

export function getTestLink(): Link {
  const link: Link = {
    brand: 'test:brand',
    cartUrl: 'https://www.example.com/cartUrl',
    model: 'test:model',
    price: 100,
    series: 'test:series',
    url: 'https://www.example.com/url',
  };
  return link;
}

export function getCaptchaSolverTestLink(): Link {
  const link: Link = {
    brand: 'test:brand',
    cartUrl: 'https://www.amazon.com/errors/validateCaptcha',
    model: 'test:model',
    price: 100,
    series: 'test:series',
    url: 'https://www.amazon.com/errors/validateCaptcha',
  };
  return link;
}

export function getTestStore(): Store {
  const storeLinks = [getTestLink(), getCaptchaSolverTestLink()];

  const store: Store = {
    currency: '',
    labels: {
      captcha: {
        container: 'body',
        text: ['enter the characters you see below'],
      },
      captchaHandler: {
        challenge: '.a-row > img',
        input: '#captchacharacters',
        submit: 'button[type="submit"]',
      },
      inStock: {
        container: 'test:container',
        text: ['test:text'],
      },
    },
    links: storeLinks,
    name: 'test:name',
  };

  return store;
}

const store = getTestStore();
// uncomment to test global default capture type setting
// if (store.labels.captchaHandler) store.labels.captchaHandler.captureType = '';

(async () => {
  const browser = await launchTestBrowser();
  const page = await browser.newPage();
  page.goto(store.links[1].url, {waitUntil: 'networkidle0'});
  await page.waitForSelector(store.labels.captchaHandler!.challenge);
  await handleCaptchaAsync(page, store);
  await browser.close();
})();
