import axios from 'axios';

const BASE_URL = 'https://orbis.money/fetch';
// const BASE_URL = 'http://127.0.0.1';
// const BASE_URL = 'http://45.66.10.242:20200'

// Common interfaces
interface BaseResponse {
  success: boolean;
  error?: string;
}

// Cryptocurrency Container Interfaces
interface CreateCryptoContainerResponse extends BaseResponse {
  address?: string;
  words?: string;
}

interface RestoreCryptoContainerResponse extends BaseResponse {
  address?: string;
}

// Transaction Interfaces
interface CreateTransactionResponse extends BaseResponse {
  owner_sign?: string;
}

interface TransactionInfoResponse extends BaseResponse {
  unix_time?: number;
  block_number?: number;
  from?: string;
  to?: string;
  hash?: string;
  token?: string;
  sent?: string;
  received?: string;
  fee?: number;
}

// Token Interfaces
interface TokenInfoResponse extends BaseResponse {
  owner_id?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  volume?: string;
  unix_time?: number;
  trans_count?: number;
  owners_count?: number;
}

// Address Information Interfaces
interface AddressInfoResponse extends BaseResponse {
  address?: string;
  id?: string;
  trans_count?: number;
  tokens_count?: number;
  received?: string;
  sent?: string;
  balance?: string;
  symbol?: string;
}

interface AddressInfoDetailsResponse extends BaseResponse {
  trans_count?: number;
  list?: Array<any>;
  earlier_trans_unix_date?: number;
  latest_trans_unix_date?: number;
  earlier_trans_unix_date_ever?: number;
  latest_trans_unix_date_ever?: number;
  tokens_count?: number;
}

interface AddressBalancesResponse extends BaseResponse {
  balances?: Array<{ symbol: string; value: string }>;
}

interface AddressTokensResponse extends BaseResponse {
  tokens?: Array<Array<{ symbol: string; name: string }>>;
}

// Service Interfaces
interface ServiceDataResponse extends BaseResponse {
  data_array?: Array<{
    id: string;
    unix_time: number;
    data: string;
  }>;
}

interface ServiceInfoResponse extends BaseResponse {
  name?: string;
  owner_id?: string;
  unix_time?: number;
}

// General Network Information Interfaces
interface GeneralInfoResponse extends BaseResponse {
  amount_list?: number;
  list?: Array<any>;
}

interface StatisticsResponse extends BaseResponse {
  list?: Array<{
    unix_time: number;
    count: number;
  }>;
}

interface MiningInfoResponse extends BaseResponse {
  next_mining_date?: number;
  OM_count?: number;
  ORBC_in_circulation?: string;
}

// Add this interface at the top with other interfaces
interface ApiError {
  message: string;
}

// Add this at the top with other imports
const logRequest = (method: string, url: string, data?: any) => {
  console.log(`[${method}] ${url}${data ? `\nData: ${JSON.stringify(data, null, 2)}` : ''}`);
};

// Cryptocurrency Container Functions
export async function createCryptoContainer(pass: string): Promise<CreateCryptoContainerResponse> {
  try {
    const url = `${BASE_URL}/create/cryptocontainer/`;
    const data = { pass };
    logRequest('POST', url, data);
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function restoreCryptoContainer(keys: string, pass: string): Promise<RestoreCryptoContainerResponse> {
  try {
    const url = `${BASE_URL}/restore/cryptocontainer/keys/`;
    const data = { keys, pass };
    logRequest('POST', url, data);
    const response = await axios.post(url, data);
    return response.data;
    } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// Transaction Functions
export async function createTransaction(
  address: string,
  pass: string,
  to: string,
  symbol: string,
  amount: string
): Promise<CreateTransactionResponse> {
  try {
    const url = `${BASE_URL}/create/transaction/`;
    const data = { address, pass, to, symbol, amount };
    logRequest('POST', url, data);
    const response = await axios.post(url, data);
    return response.data;
    } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function checkTransaction(ownerSign: string): Promise<TransactionInfoResponse> {
  try {
    const url = `${BASE_URL}/check/transaction/`;
    const params = { owner_sign: ownerSign };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
    } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getTransactionInfo(hash: string): Promise<TransactionInfoResponse> {
  try {
    const url = `${BASE_URL}/transaction_info/`;
    const data = { hash, net: "main", str: "explorer" };
    const headers = {
        'Content-Type': 'text/plain;charset=UTF-8'
    }
    logRequest('POST', url, data);
    const response = await axios.post(url, data, {headers});
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// Token Functions
export async function createToken(
  address: string,
  pass: string,
  name: string,
  symbol: string,
  emission: string,
  capacity: string
): Promise<BaseResponse> {
  try {
    const url = `${BASE_URL}/create/token/`;
    const data = { address, pass, name, symbol, emission, capacity };
    logRequest('POST', url, data);
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getTokenInfo(symbol: string): Promise<TokenInfoResponse> {
  try {
    const url = `${BASE_URL}/token_info/`;
    const params = { symbol };
    logRequest('GET', url, params);
    const response = await axios.post(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// Balance Functions
export async function getBalance(address: string, token: string): Promise<BaseResponse & { balance?: string }> {
  try {
    const url = `${BASE_URL}/balance/`;
    const params = { address, token };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// OM Functions
export async function buyOM(address: string, pass: string): Promise<BaseResponse> {
  try {
    const url = `${BASE_URL}/buy/om/`;
    const data = { address, pass };
    logRequest('POST', url, data);
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function checkOM(address: string): Promise<BaseResponse & { om_holder?: boolean }> {
  try {
    const url = `${BASE_URL}/checkom/`;
    const params = { address };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// Address Information Functions
export async function getAddressInfo(address: string, tokens: string): Promise<AddressInfoResponse> {
  try {
    const url = `${BASE_URL}/address_info/`;
    const params = { address, tokens };
    logRequest('GET', url, params);
    const response = await axios.post(url, params );
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getAddressInfoDetails(
  tab: 'transactions' | 'tokens',
  address: string,
  tokens: string,
  page: number,
  pagesize: number,
  date_from?: string,
  date_to?: string,
  type?: 'incoming' | 'outgoing' | 'all'
): Promise<AddressInfoDetailsResponse> {
  try {
    const url = `${BASE_URL}/address_info_details/`;
    const params: any = { tab, address, tokens, page, pagesize, earlier: "", lang: "en", latest: "", net:"main", type: "all" };
    const headers = {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.orbis.money/',
        'Origin': 'https://www.orbis.money',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

    }
    if (date_from) params.date_from = date_from;
    if (date_to) params.date_to = date_to;
    if (type) params.type = type;
    
    logRequest('POST', url, params);
    const response = await axios.post(url, params, {headers});
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getAddressBalances(address: string): Promise<AddressBalancesResponse> {
  try {
    const url = `${BASE_URL}/address_balances/`;
    const params = { address };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getAddressTokens(address: string): Promise<AddressTokensResponse> {
  try {
    const url = `${BASE_URL}/address_tokens/`;
    const params = { address };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// Service Functions
export async function getServiceData(name: string): Promise<ServiceDataResponse> {
  try {
    const url = `${BASE_URL}/service/get_data/`;
    const params = { name };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getServiceInfo(name: string): Promise<ServiceInfoResponse> {
  try {
    const url = `${BASE_URL}/service_info/`;
    const params = { name };
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

// General Network Information Functions
export async function getGeneralInfo(
  name: 'accounts' | 'transactions' | 'tokens' | 'services' | 'mined' | 'mining' | 'main_info',
  page: number,
  pagesize: number,
  sortby?: string,
  inverse?: boolean
): Promise<GeneralInfoResponse> {
  try {
    const url = `${BASE_URL}/general_info/`;
    const params: any = { name, page, pagesize };
    
    if (sortby) params.sortby = sortby;
    if (inverse !== undefined) params.inverse = inverse;
    
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getStatistics(
  tab: 'validators',
  date_from?: string,
  date_to?: string,
  step?: number
): Promise<StatisticsResponse> {
  try {
    const url = `${BASE_URL}/statistics/`;
    const params: any = { tab };
    
    if (date_from) params.date_from = date_from;
    if (date_to) params.date_to = date_to;
    if (step) params.step = step;
    
    logRequest('GET', url, params);
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

export async function getMiningInfo(): Promise<MiningInfoResponse> {
  try {
    const url = `${BASE_URL}/mining_info/`;
    logRequest('GET', url);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    const err = error as ApiError;
    return { success: false, error: err.message };
  }
}

const keys = 'bicycle income legal nice clutch age actor spatial begin inquiry room explain tip wheel shrimp fluid time winner wire hotel tower news poem leaf machine reopen impose enjoy quit resource coffee random horror year observe outside beef order upgrade inner oval jewel behind double shrimp connect endless';
const address = "CDt7XzseKpVm8rHCu48r7HQvsez99qTjz6T8FZyU3DTo";

async function main() {
    const r = await restoreCryptoContainer(keys, "Q1W2e3r4!");
    // const r = await createTransaction(address, "Q1w2e3r4!", "CaPEMaqLjwg9MYswy7pefBstLvzeEbQ1XSUrhmiykVT", "ORBC", "1");
    // const r = await getTransactionInfo("DaFh7k8nzBqaKqUfhRkXUtsgSTKPZPwtWpqwMswG74wp")
    // const r = await getBalance(address, "ORBC")
    // const r = await getAddressInfo(address, "all")
    // const r = await getAddressInfoDetails("transactions", "7EUGBhZ3ov5nAQj7BbH2ZwoPA3hv76Z6EoETwzx2YRru", "all", 1, 10)
    
    console.log(r)
}

main()
