import {
  HttpLink
} from 'apollo-link-http';
import {
  setContext
} from 'apollo-link-context';
import Prismic from 'prismic-javascript';
import removeWhiteSpace from './lib/removeWhiteSpace';

const PRISMIC_ENDPOINT_REG = /^https?:\/\/([^.]+)\.(?:cdn\.)?(wroom\.(?:test|io)|prismic\.io)\/graphql\/?/;
//                                        ^                  ^
//                                        1                  2

function parsePrismicEndpoint(endpoint) {
  const tokens = endpoint.match(PRISMIC_ENDPOINT_REG);

  if (tokens !== null && Array.isArray(tokens) && tokens.length === 3) {
    const [ /* endpoint */ , repository, domain] = tokens;

    return `https://${repository}.cdn.${domain}`; // enforce the cdn
  }

  return null; // not from prismic ? returns null.
}

export function PrismicLink({
  uri,
  accessToken,
  repositoryName
}) {

  const prismicEndpoint = parsePrismicEndpoint(uri); // enforce cdn if it's the prismic endpoint

  if (prismicEndpoint && repositoryName) {
    console.warn('\`repositoryName\` is ignored since the graphql endpoint is valid.');
  }

  if (!prismicEndpoint && !repositoryName) {
    throw Error('Since you are using a custom GraphQL endpoint, you need to provide to PrismicLink your repository name as shown below:\n' +
      'PrismicLink({\n' +
      '  uri: \'https://mycustomdomain.com/graphql\',\n' +
      '  accessToken: \'my_access_token\', // could be undefined\n' +
      '  repositoryName: \'my-prismic-repository\'\n' +
      '})\n'
    );
  }

  let apiEndpoint;
  let gqlEndpoint;

  if (prismicEndpoint) {
    apiEndpoint = `${prismicEndpoint}/api`;
    gqlEndpoint = `${prismicEndpoint}/graphql`;
  } else {
    apiEndpoint = `https://${repositoryName}.cdn.prismic.io/api`;
    gqlEndpoint = uri;
  }

  const prismicClient = Prismic.client(apiEndpoint, {
    accessToken
  });

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
      keys.push.apply(keys, symbols);
    }
    return keys;
  }

  function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};
      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }
    return target;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }

  const prismicLink = setContext((request, options) => {
    return prismicClient.getApi().then(api => ({
      headers: _objectSpread({
        'Prismic-ref': api.masterRef.ref
      }, options.headers, {}, api.integrationFieldRef ? {
        'Prismic-integration-field-ref': api.integrationFieldRef
      } : {}, {}, accessToken ? {
        Authorization: `Token ${accessToken}`
      } : {})
    }));
  });

  const httpLink = new HttpLink({
    uri: gqlEndpoint,
    useGETForQueries: true,
    fetch: (url, options) => {
      const trimmed = removeWhiteSpace(url);
      return fetch(trimmed, options)
    }
  });

  return prismicLink.concat(httpLink);
}

export default {
  PrismicLink
};