import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { getHttpEndpoint } from '@orbs-network/ton-access';

async function deploy() {
    // Initialize TON client
    const endpoint = await getHttpEndpoint({ network: 'testnet' });
    const client = new TonClient({ endpoint });

    // Load deployer wallet
    const mnemonic = process.env.DEPLOYER_MNEMONIC;
    if (!mnemonic) throw new Error('DEPLOYER_MNEMONIC not set');
    
    const key = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    
    // Check wallet balance
    const balance = await contract.getBalance();
    console.log(`Deployer wallet balance: ${balance} TON`);
    
    if (balance.lt(1)) {
        throw new Error('Insufficient balance for deployment');
    }

    // Deploy contract
    const MindBurnPayments = {
        // Contract code cell goes here - will be added after compilation
        code: Buffer.from(''),
        // Initial data cell
        data: {
            ownerAddress: wallet.address,
            minStake: '100000000', // 0.1 TON
        },
    };

    try {
        const deployResult = await contract.deploy({
            value: '0.5', // 0.5 TON for deployment
            body: internal({
                value: '0.1', // Initial balance
                bounce: false,
            }),
        });

        console.log('Contract deployed successfully!');
        console.log('Address:', deployResult.address.toString());
        
        // Verify deployment
        const deployed = await client.isContractDeployed(deployResult.address);
        if (deployed) {
            console.log('Contract deployment verified');
        } else {
            console.error('Contract deployment failed verification');
        }
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

deploy().catch(console.error); 