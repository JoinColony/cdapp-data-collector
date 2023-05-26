import dotenv from 'dotenv';
import { providers } from 'ethers';

dotenv.config();

const provider = new providers.JsonRpcProvider(process.env.NETWORK_RPC_ENDPOINT);

export default provider;
