import { PaymentService } from './services/payment';
import { getConfig } from './config';

export * from './services/payment';
export * from './config';

const config = getConfig();
const paymentService = new PaymentService(config.tonEndpoint);

export { paymentService };