import { default as fetch, Request } from 'node-fetch';

const graphQl = async (queryOrMutation, variables, url = process.env.SUBGRAPH_ADDRESS, extraHeaders = {}) => {
  const options = {
    method: 'POST',
    headers: {
      ...extraHeaders,
      // 'x-api-key': authKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: queryOrMutation,
      variables,
    }),
  };

  const request = new Request(url, options);

  let body;
  let response;

  try {
    response = await fetch(request);
    body = await response.json();
    return body;
  } catch (error) {
    /*
     * Something went wrong... obviously
     */
    console.error(error);
    return null;
  }
};

export default graphQl;
