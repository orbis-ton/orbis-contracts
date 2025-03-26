import puppeteer, { Browser, Page } from 'puppeteer';

interface Transaction {
  hash: string;
  amount: number;
}

interface TransactionDetails {
  sender: string | null;
  recipient: string | null;
  amount: number | null;
  tokenSymbol: string | null;
  blockNumber: number | null;
}

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}

async function navigateToPage(page: Page, url: string, waitForSelector: string): Promise<void> {
  console.log(`Navigating to: ${url}`);
  await page.goto(url);
  await page.waitForSelector(waitForSelector, { timeout: 60000 });
}

async function extractTransactionDetails(page: Page): Promise<TransactionDetails> {
  return page.evaluate(() => {
    const detailsElement = document.querySelector('.transaction__details-wrap');
    if (!detailsElement) {
      return {
        sender: null,
        recipient: null,
        amount: null,
        tokenSymbol: null,
        blockNumber: null
      };
    }

    const getAddress = (label: string) => {
      const element = Array.from(detailsElement.querySelectorAll('.transaction__details-item__title'))
        .find(el => el.textContent?.includes(label));
      return element?.nextElementSibling?.querySelector('a')?.textContent?.trim() ?? null;
    };

    const getAmount = () => {
      const element = Array.from(detailsElement.querySelectorAll('.transaction__details-item__title'))
        .find(el => el.textContent?.includes("Sent"));
      const amountText = element?.nextElementSibling?.textContent?.trim() ?? null;
      return amountText ? parseFloat(amountText.replace(/,/g, '')) : null;
    };

    const getTokenSymbol = () => {
      const element = Array.from(detailsElement.querySelectorAll('.transaction__details-item__title'))
        .find(el => el.textContent?.includes("Token"));
      return element?.nextElementSibling?.querySelector('a')?.textContent?.trim() ?? null;
    };

    const getBlockNumber = () => {
      const element = Array.from(detailsElement.querySelectorAll('.transaction__details-item__title'))
        .find(el => el.textContent?.includes("BlockNumber"));
      const blockNumberText = element?.nextElementSibling?.textContent?.trim() ?? null;
      return blockNumberText ? parseInt(blockNumberText, 10) : null;
    };

    return {
      sender: getAddress("From"),
      recipient: getAddress("To"),
      amount: getAmount(),
      tokenSymbol: getTokenSymbol(),
      blockNumber: getBlockNumber()
    };
  });
}

async function getTransactionDetailsFromTxPage(txHash: string): Promise<TransactionDetails> {
  console.log(`Fetching transaction details for transaction: ${txHash}`);
  const url = `https://www.orbis.money/explorer/main/transactions/${txHash}`;
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await navigateToPage(page, url, '.transaction__details-wrap');
    const transactionDetails = await extractTransactionDetails(page);
    console.log(`Transaction details: ${JSON.stringify(transactionDetails)}`);
    return transactionDetails;
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return {
      sender: null,
      recipient: null,
      amount: null,
      tokenSymbol: null,
      blockNumber: null
    };
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

async function findOutgoingTxHashes10000(address: string): Promise<string[]> {
  console.log(`Starting to parse explorer pages for address: ${address}`);
  const browser = await launchBrowser();
  const allHashes: string[] = [];

  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const url = `https://www.orbis.money/explorer/main/address/${address}?pageSize=100&type=outgoing&page=${currentPage}`;
      await navigateToPage(page, url, '.transaction__history');

      console.log(`Extracting transactions from page ${currentPage}...`);
      const transactions = await page.evaluate(() => {
        const result: Transaction[] = [];
        const rows = document.querySelectorAll('.transaction__history-item');
        
        rows.forEach(row => {
          const hashElement = row.querySelector('.transaction__history-item__hash-title a');
          const amountElement = row.querySelector('.transaction__history-item__amount');

          if (hashElement && amountElement) {
            const hash = hashElement.textContent?.trim() || '';
            const amountText = amountElement.textContent?.trim() || '';

            const amountMatch = amountText.match(/[\d,.]+/);
            if (amountMatch) {
              const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
              result.push({ hash, amount });
            }
          }
        });

        return result;
      });

      const hashes = transactions.filter(tx => tx.amount === 10000).map(tx => tx.hash);
      allHashes.push(...hashes);

      console.log(`Found ${transactions.length} transactions on page ${currentPage}`);

      // Check if there are more pages
      hasMorePages = transactions.length > 0;
      currentPage++;
    }

    console.log('Finished parsing all pages.');
    return allHashes;

  } catch (error) {
    console.error('Error parsing explorer pages:', error);
    return allHashes;
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

export async function hasOM(address: string) {
  const txHashes = await findOutgoingTxHashes10000(address);
  const results = await Promise.all(txHashes.map(async (tx) => {
    const details = await getTransactionDetailsFromTxPage(tx);
    console.log(details);
    return details.recipient === "11111111111111111111111111111111";
  }));
  return results.some(result => result);
}

async function findIncomingTxsAfterBlock(address: string, blockFrom: number): Promise<TransactionDetails[]> {
  console.log(`Collecting incoming transactions for address: ${address} after block: ${blockFrom}`);
  const browser = await launchBrowser();
  const collectedTransactions: TransactionDetails[] = [];

  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const url = `https://www.orbis.money/explorer/main/address/${address}?pageSize=100&type=incoming&page=${currentPage}`;
      await navigateToPage(page, url, '.transaction__history');

      console.log(`Extracting transactions from page ${currentPage}...`);
      const transactions = await page.evaluate(() => {
        const result: string[] = [];
        const rows = document.querySelectorAll('.transaction__history-item');
        
        rows.forEach(row => {
          const hashElement = row.querySelector('.transaction__history-item__hash-title a');
          if (hashElement) {
            const hash = hashElement.textContent?.trim() || '';
            result.push(hash);
          }
        });

        return result;
      });

      const transactionDetails: TransactionDetails[] = [];
      for (let i = 0; i < transactions.length; i += 10) {
        const chunk = transactions.slice(i, i + 10);
        const transactionDetailsPromises = chunk.map(txHash => getTransactionDetailsFromTxPage(txHash));
        const chunkDetails = await Promise.all(transactionDetailsPromises);
        transactionDetails.push(...chunkDetails);
      }

      const validTransactions = transactionDetails.filter(details => details.blockNumber !== null && details.blockNumber > blockFrom);
      collectedTransactions.push(...validTransactions);

      if (validTransactions.length < transactions.length) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    collectedTransactions.sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));
    console.log(collectedTransactions)
    return collectedTransactions;

  } catch (error) {
    console.error('Error collecting incoming transactions:', error);
    return collectedTransactions;
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

// Example usage
// hasOM("7EUGBhZ3ov5nAQj7BbH2ZwoPA3hv76Z6EoETwzx2YRru")
// hasOM("DBH1jreoA3sTtapqjF8UKrncJW7QU9FuHwok3Dii77wL");

findIncomingTxsAfterBlock("DBH1jreoA3sTtapqjF8UKrncJW7QU9FuHwok3Dii77wL", 99225)