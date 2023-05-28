import { Wallet } from 'ethers';
import { default as fetch, Request } from 'node-fetch';

const postRequest = async (path, data) => {
  const request = new Request(`${process.env.COLONYSERVER_ADDRESS}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const response = await fetch(request);
  return response.json();
};

export const getBearerToken = async () => {
  const wallet = new Wallet(process.env.PRIVKEY);

  const { challenge } = await postRequest('/auth/challenge', {
    address: wallet.address,
  });
  const signature = await wallet.signMessage(challenge);
  const { token: refreshedToken } = await postRequest('/auth/token', {
    challenge,
    signature,
  });
  return refreshedToken;
};
