import { default as fetch, Request } from 'node-fetch';

const ipfs = async (hash, url = process.env.IPFS_GATEWAY) => {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const request = new Request(`${url}/${hash}`, options);

  let body;
  let response;

  try {
    response = await fetch(request);
    if (response) {
      body = await response.json();
      return body;
    }
  } catch (error) {
    /*
     * Something went wrong... obviously
     */
    console.error(error);
    return null;
  }
};

export default ipfs;
