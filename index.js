const fs = require('fs');
const https = require('https');
const { ethers } = require('ethers');
const readline = require('readline');
const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment');

// ASCII Art Banner
const banner = [
    chalk.cyan('=========================================='),
    chalk.cyan('            INFINITY GROUND              '),
    chalk.yellow('        Developed by: HIMANSHU SAROHA      '),
    chalk.cyan('=========================================='),
    ''
].join('\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to read private keys from file
function readPrivateKeys(filename) {
    try {
        if (!fs.existsSync(filename)) {
            console.log(`Creating new file: ${filename}`);
            fs.writeFileSync(filename, '', 'utf8');
            return [];
        }
        return fs.readFileSync(filename, 'utf8').split('\n').map(key => key.trim()).filter(key => key);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Function to create new wallet and save private key
function createAndSaveWallet(filename) {
    const wallet = ethers.Wallet.createRandom();
    const privateKey = wallet.privateKey;
    fs.appendFileSync(filename, privateKey + '\n', 'utf8');
    return privateKey;
}

// Function to get wallet address from private key
function getWalletAddress(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
}

// Function to create API instance with token
function createApiInstance(token) {
    return axios.create({
        baseURL: 'https://api.infinityg.ai/api/v1',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Origin': 'https://www.infinityg.ai',
            'Referer': 'https://www.infinityg.ai/'
        }
    });
}

// Function to format response
function formatResponse(response) {
    if (response.code === '90000' && response.message === '成功') {
        return {
            ...response,
            message: 'Success',
            status: 'Operation completed successfully'
        };
    }
    return response;
}

// Function to perform wallet login and get token
async function performWalletLogin(privateKey) {
    try {
        const walletAddress = getWalletAddress(privateKey);
        console.log(`\n${chalk.blue('Logging in wallet:')} ${chalk.green(walletAddress)}`);
        
        const loginOptions = {
            hostname: 'api.infinityg.ai',
            path: '/api/v1/user/auth/wallet_login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const loginPayload = JSON.stringify({
            loginChannel: 'MAIN_PAGE',
            walletChain: 'Ethereum',
            walletType: 'metamask',
            walletAddress: walletAddress,
            privateKey: privateKey
        });

        return new Promise((resolve, reject) => {
            const req = https.request(loginOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const response = JSON.parse(data);
                    if (response.data) {
                        console.log(`${chalk.green('Login Success for:')} ${chalk.green(walletAddress)}`);
                        resolve({
                            token: response.data.token,
                            walletAddress: walletAddress
                        });
                    } else {
                        console.error(`${chalk.red('Login Failed for:')} ${chalk.green(walletAddress)}`);
                        reject(new Error('Login failed'));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`${chalk.red('Login Error:')}`, error);
                reject(error);
            });

            req.write(loginPayload);
            req.end();
        });
    } catch (error) {
        console.error(`${chalk.red('Error in wallet login:')}`, error);
        throw error;
    }
}

// Function to get balance and check-in details
async function getBalanceAndCheckInDetails(token, walletAddress) {
    try {
        const api = createApiInstance(token);
        const response = await api.get('/task/list');
        if (response.data.code === "90000") {
            const data = response.data.data;
            const today = moment().format('YYYY-MM-DD');
            const todayCheckIn = data.checkInList.find(checkIn => checkIn.date === today);
            
            return {
                totalPoints: data.totalPoint,
                checkInNo: todayCheckIn ? todayCheckIn.checkInNo : '0',
                checkInPoints: todayCheckIn ? todayCheckIn.point : '0',
                username: data.twitterUserName
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting balance:', error);
        return null;
    }
}

// Function to perform check-in with token
async function performCheckInWithToken(token, walletAddress, index, total) {
    try {
        // First get current balance and check-in status
        const api = createApiInstance(token);
        const balanceResponse = await api.post('/task/list', {}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`\n${chalk.cyan(`[${index}/${total}]`)} ${chalk.yellow('Wallet:')} ${chalk.green(walletAddress)}`);
        console.log(`${chalk.blue('Status:')} ${chalk.green('Login successful')}`);
        console.log(`${chalk.blue('Daily check-in fetching...')}`);

        // Perform daily check-in regardless of previous status
        const response = await api.post('/task/checkIn/');
        
        if (response.data.code === "90000") {
            console.log(`${chalk.green('Daily Check-in Successfully')}`);
            // Get updated balance after successful check-in
            try {
                const updatedBalanceResponse = await api.post('/task/list', {}, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (updatedBalanceResponse.data.code === "90000" && updatedBalanceResponse.data.data) {
                    const data = updatedBalanceResponse.data.data;
                    console.log(`${chalk.blue('Total Points:')} ${chalk.green(data.totalPoint)}`);
                    const today = moment().format('YYYY-MM-DD');
                    const updatedTodayCheckIn = data.checkInList.find(checkIn => checkIn.date === today);
                    if (updatedTodayCheckIn) {
                        console.log(`${chalk.blue('Check-in No:')} ${chalk.green(updatedTodayCheckIn.checkInNo)}`);
                        console.log(`${chalk.blue('Check-in Points:')} ${chalk.green(updatedTodayCheckIn.point)}`);
                    }
                }
            } catch (balanceError) {
                // Ignore balance check error
            }
        } else {
            console.log(`${chalk.red('Daily Check-in Failed:')} ${chalk.yellow(response.data.message)}`);
        }
        console.log(chalk.gray('============================================'));
        
        return response.data;
    } catch (error) {
        console.log(`\n${chalk.cyan(`[${index}/${total}]`)} ${chalk.yellow('Wallet:')} ${chalk.green(walletAddress)}`);
        if (error.response?.data?.message) {
            console.log(`${chalk.red('Error:')} ${chalk.yellow(error.response.data.message)}`);
        } else {
            console.log(`${chalk.red('Error:')} ${chalk.yellow(error.message)}`);
        }
        console.log(chalk.gray('============================================'));
        throw error;
    }
}

// Function to perform check-in
async function performCheckIn(privateKey, index, total) {
    try {
        // First perform wallet login to get token
        const { token, walletAddress } = await performWalletLogin(privateKey);
        
        // Wait a bit after login
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Now perform check-in with token
        await performCheckInWithToken(token, walletAddress, index, total);
    } catch (error) {
        console.log(`\n[${index}/${total}] Wallet: ${walletAddress}`);
        console.log('Error:', error.message);
        console.log('============================================');
        throw error;
    }
}

// Function to perform referral check-in
async function performReferralCheckIn(privateKey, index, total) {
    try {
        // First perform wallet login to get token
        const { token, walletAddress } = await performWalletLogin(privateKey);
        
        // Wait a bit after login
        await new Promise(resolve => setTimeout(resolve, 2000));

        // First get current balance and check-in status
        const api = createApiInstance(token);
        const balanceResponse = await api.post('/task/list', {}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`\n${chalk.cyan(`[${index}/${total}]`)} ${chalk.yellow('Wallet:')} ${chalk.green(walletAddress)}`);
        console.log(`${chalk.blue('Status:')} ${chalk.green('Login successful')}`);
        console.log(`${chalk.blue('Referral check-in fetching...')}`);

        // Perform referral check-in regardless of previous status
        const response = await api.post('/task/checkIn/');
        
        if (response.data.code === "90000") {
            console.log(`${chalk.green('Referral Check-in Successfully')}`);
            // Get updated balance after successful check-in
            try {
                const updatedBalanceResponse = await api.post('/task/list', {}, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (updatedBalanceResponse.data.code === "90000" && updatedBalanceResponse.data.data) {
                    const data = updatedBalanceResponse.data.data;
                    console.log(`${chalk.blue('Total Points:')} ${chalk.green(data.totalPoint)}`);
                    const today = moment().format('YYYY-MM-DD');
                    const updatedTodayCheckIn = data.checkInList.find(checkIn => checkIn.date === today);
                    if (updatedTodayCheckIn) {
                        console.log(`${chalk.blue('Check-in No:')} ${chalk.green(updatedTodayCheckIn.checkInNo)}`);
                        console.log(`${chalk.blue('Check-in Points:')} ${chalk.green(updatedTodayCheckIn.point)}`);
                    }
                }
            } catch (balanceError) {
                // Ignore balance check error
            }
        } else {
            console.log(`${chalk.red('Referral Check-in Failed:')} ${chalk.yellow(response.data.message)}`);
        }
        console.log(chalk.gray('============================================'));
        
        return response.data;
    } catch (error) {
        console.log(`\n${chalk.cyan(`[${index}/${total}]`)} ${chalk.yellow('Wallet:')} ${chalk.green(walletAddress)}`);
        if (error.response?.data?.message) {
            console.log(`${chalk.red('Error:')} ${chalk.yellow(error.response.data.message)}`);
        } else {
            console.log(`${chalk.red('Error:')} ${chalk.yellow(error.message)}`);
        }
        console.log(chalk.gray('============================================'));
        throw error;
    }
}

// Function to perform HTTP POST request for login
function performLogin(privateKey, inviteCode) {
    return new Promise((resolve, reject) => {
        const walletAddress = getWalletAddress(privateKey);
        
        const options = {
            hostname: 'api.infinityg.ai',
            path: '/api/v1/user/auth/wallet_login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const payload = JSON.stringify({
            loginChannel: 'MAIN_PAGE',
            walletChain: 'Ethereum',
            walletType: 'metamask',
            walletAddress: walletAddress,
            inviteCode: inviteCode,
            privateKey: privateKey
        });

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const response = JSON.parse(data);
                if (response.data) {
                    console.log('\n=== Login Success ===');
                    console.log('Username:', response.data.userName);
                    console.log('Wallet Address:', response.data.walletAddress);
                    console.log('Used Referral Code:', inviteCode);
                    console.log('===================\n');
                } else {
                    console.error('\nLogin Failed:', response.message, '\n');
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error('Error:', error);
            reject(error);
        });

        req.write(payload);
        req.end();
    });
}

// Function to perform HTTP POST request for inviting a new user
function inviteUser(inviteCode, privateKey) {
    const walletAddress = getWalletAddress(privateKey);
    
    const options = {
        hostname: 'api.infinityg.ai',
        path: '/api/v1/user/invite',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${privateKey}`
        }
    };

    const payload = JSON.stringify({
        inviteCode: inviteCode,
        walletAddress: walletAddress
    });

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            const response = JSON.parse(data);
            console.log('Invite Response:', response);
        });
    });

    req.on('error', (error) => {
        console.error('Error:', error);
    });

    req.write(payload);
    req.end();
}

// Function to perform daily check-in
function performDailyCheckIn(privateKey) {
    const walletAddress = getWalletAddress(privateKey);
    
    const options = {
        hostname: 'api.infinityg.ai',
        path: '/api/v1/user/check-in',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${privateKey}`
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            const response = JSON.parse(data);
            console.log('Daily Check-in Response:', response);
        });
    });

    req.on('error', (error) => {
        console.error('Error:', error);
    });

    req.end();
}

// Function to check balance
async function checkBalance(privateKey) {
    try {
        // First perform login
        const walletAddress = getWalletAddress(privateKey);
        console.log('\nLogging in wallet:', walletAddress);
        
        const loginOptions = {
            hostname: 'api.infinityg.ai',
            path: '/api/v1/user/auth/wallet_login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const loginPayload = JSON.stringify({
            loginChannel: 'MAIN_PAGE',
            walletChain: 'Ethereum',
            walletType: 'metamask',
            walletAddress: walletAddress,
            privateKey: privateKey
        });

        // Perform login first and get token
        const loginResponse = await new Promise((resolve, reject) => {
            const req = https.request(loginOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const response = JSON.parse(data);
                    if (response.data) {
                        console.log('Login Success for:', walletAddress);
                        resolve(response.data);
                    } else {
                        console.error('Login Failed for:', walletAddress);
                        reject(new Error('Login failed'));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Login Error:', error);
                reject(error);
            });

            req.write(loginPayload);
            req.end();
        });

        // Wait a bit after login
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Now check balance with token
        const balanceOptions = {
            hostname: 'api.infinityg.ai',
            path: '/api/v1/task/list',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginResponse.token}`
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(balanceOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    const response = JSON.parse(data);
                    if (response.code === "90000") {
                        console.log('\n=== Balance Information ===');
                        console.log('Wallet:', walletAddress);
                        console.log('Username:', response.data.twitterUserName);
                        console.log('Total Points:', response.data.totalPoint);
                        console.log('Game Points:', response.data.gamePoint);
                        console.log('Create App Points:', response.data.createAppPoint);
                        console.log('===================\n');
                    } else {
                        console.error('\nFailed to fetch balance:', response.message);
                        console.log('Wallet:', walletAddress, '\n');
                    }
                    resolve();
                });
            });

            req.on('error', (error) => {
                console.error('Error:', error);
                reject(error);
            });

            req.end();
        });
    } catch (error) {
        console.error('Error in balance check process:', error);
        throw error;
    }
}

// Function to display menu and handle user choice
async function displayMenu() {
    console.log(chalk.cyan('DASHBOARD'));
    console.log(chalk.cyan('   INFINITY GROUND'));
    console.log(chalk.yellow('        Developed by: HIMANSHU SAROHA'));
    console.log(chalk.green("|''||''| '||\\   ||` '||''''| |''||''| '||\\   ||` |''||''| |''||''| '\\\\  //`"));
    console.log(chalk.green("   ||     ||\\\\  ||   ||  .      ||     ||\\\\  ||     ||       ||      \\\\//   "));
    console.log(chalk.green("   ||     || \\\\ ||   ||''|      ||     || \\\\ ||     ||       ||       ||    "));
    console.log(chalk.green("   ||     ||  \\\\||   ||         ||     ||  \\\\||     ||       ||       ||    "));
    console.log(chalk.green("|..||..| .||   \\||. .||.     |..||..| .||   \\||. |..||..|   .||.     .||.   "));
    console.log('');
    console.log(chalk.cyan('=== InfinityG Menu ==='));
    console.log(`${chalk.yellow('1.')} Daily Check-in`);
    console.log(`${chalk.yellow('2.')} Auto Referral`);
    console.log(`${chalk.yellow('3.')} Referral Check-in`);
    console.log(`${chalk.yellow('4.')} Exit`);
    
    const choice = await new Promise((resolve) => {
        rl.question(`\n${chalk.blue('Enter your choice (1-4):')} `, (answer) => {
            resolve(answer.trim());
        });
    });

    return choice;
}

// Main execution
async function main() {
    try {
        // Display banner at startup
        console.log(chalk.cyan('=========================================='));
        console.log(chalk.cyan('            INFINITY GROUND              '));
        console.log(chalk.yellow('        Developed by: HIMANSHU SAROHA      '));
        console.log(chalk.cyan('=========================================='));
        console.log('');
        
        while (true) {
            const choice = await displayMenu();
            
            switch (choice) {
                case '1':
                    // Daily Check-in - using prvt.txt
                    const privateKeys = readPrivateKeys('prvt.txt');
                    const totalWallets = privateKeys.length;
                    console.log(`\n${chalk.cyan(`Performing daily check-in for ${totalWallets} wallets from prvt.txt...`)}\n`);
                    
                    for (let i = 0; i < privateKeys.length; i++) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await performCheckIn(privateKeys[i], i + 1, totalWallets);
                    }
                    console.log(`\n${chalk.green('All check-ins completed!')}\n`);
                    break;

                case '2':
                    // Auto Referral
                    const inviteCode = await new Promise((resolve) => {
                        rl.question(`${chalk.blue('Enter your referral code:')} `, (code) => {
                            resolve(code.trim());
                        });
                    });

                    const numWallets = await new Promise((resolve) => {
                        rl.question(`${chalk.blue('How many wallets to create?')} `, (num) => {
                            resolve(parseInt(num.trim()));
                        });
                    });

                    console.log(`\n${chalk.cyan(`Creating ${numWallets} new wallets...`)}`);
                    const newPrivateKeys = [];
                    for (let i = 0; i < numWallets; i++) {
                        const privateKey = createAndSaveWallet('reffpvt.txt');
                        newPrivateKeys.push(privateKey);
                        console.log(`${chalk.green(`Created wallet ${i + 1}/${numWallets}`)}`);
                    }

                    console.log(`\n${chalk.cyan('Performing login for all wallets...')}\n`);
                    for (const privateKey of newPrivateKeys) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await performLogin(privateKey, inviteCode);
                    }
                    
                    console.log(`\n${chalk.green('All operations completed!')}\n`);
                    break;

                case '3':
                    // Referral Check-in - using reffpvt.txt
                    const refPrivateKeys = readPrivateKeys('reffpvt.txt');
                    const totalRefWallets = refPrivateKeys.length;
                    console.log(`\n${chalk.cyan(`Performing referral check-in for ${totalRefWallets} wallets from reffpvt.txt...`)}\n`);
                    
                    for (let i = 0; i < refPrivateKeys.length; i++) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await performReferralCheckIn(refPrivateKeys[i], i + 1, totalRefWallets);
                    }
                    console.log(`\n${chalk.green('All referral check-ins completed!')}\n`);
                    break;

                case '4':
                    console.log(`${chalk.yellow('Exiting program...')}`);
                    rl.close();
                    process.exit(0);
                    break;

                default:
                    console.log(`${chalk.red('Invalid choice. Please try again.')}`);
            }
        }
    } catch (error) {
        console.error(`${chalk.red('Error:')}`, error);
        rl.close();
    }
}

main();
