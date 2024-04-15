export default interface IConfig {
  notification: {
    phone_number_id: string;
    api_secret_key: string;
  };
  payments: {
    razorpay_key_id: string;
    razorpay_key_secret: string;
  };
}
