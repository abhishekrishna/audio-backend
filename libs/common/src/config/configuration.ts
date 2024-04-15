import Config from './config.type';

export default (): Config => ({
  notification: {
    phone_number_id: process.env.PHONE_NUMBER_ID,
    api_secret_key: process.env.API_SECRET_KEY,
  },
  payments: {
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET,
  },
});
