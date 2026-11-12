/**
 * The payment rails a customer can save, in the order the app lists them. The enum on
 * the saved method, the enum on a Payment and the validation on POST
 * /auth/me/payment-methods all read this list, so adding a rail is a one-line change
 * that cannot leave the three of them disagreeing.
 *
 * apps/shared/paybrands.js mirrors it for the client, next to each rail's brand mark.
 */
const PAYMENT_BRANDS = ['card', 'telebirr', 'mpesa', 'cbebir', 'cash'];

module.exports = { PAYMENT_BRANDS };
