
export default async function handler(ctx) {

    const { URLSearchParams } = await require('node:url');
    const { req } = ctx;

    const currentHost = req.headers['x-forwarded-host'] || req.headers['host'];
    
    // 定义允许调用的域名白名单 (不带协议 http://)
    const ALLOWED_DOMAINS = [
        currentHost,
        'localhost',
        '127.0.0.1'
    ];

    // 最低金额限制
    const MIN_AMOUNT_CNY = 5; 

    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    let requestDomain = null;

    try {
        if (origin) requestDomain = new URL(origin).host;
        else if (referer) requestDomain = new URL(referer).host;
    } catch (e) {}

    if (requestDomain && !ALLOWED_DOMAINS.includes(requestDomain)) {
        console.warn(`Blocked unauthorized request from: ${requestDomain}`);
        return ctx.throws(403, `Forbidden: Domain '${requestDomain}' is not allowed.`);
    }

    if (!ctx.secret || !ctx.secret.key) {
        return ctx.throws(500, 'Missing Stripe Secret Key');
    }

    const body = req.body || {};
    if (!body.amount) {
        return ctx.throws(400, 'Amount is required');
    }

    const inputAmount = Number(body.amount);

    if (isNaN(inputAmount)) {
        return ctx.throws(400, 'Invalid amount format');
    }

    if (inputAmount < MIN_AMOUNT_CNY) {
        return ctx.throws(400, `Amount too low. Minimum allowed is ¥${MIN_AMOUNT_CNY}`);
    }

    const amountInCents = String(Math.round(inputAmount * 100));

    const token = 'Bearer ' + ctx.secret.key;

    try {
        const params = new URLSearchParams();
        params.append('line_items[0][price_data][currency]', 'cny');
        params.append('line_items[0][price_data][unit_amount]', amountInCents);

        params.append('line_items[0][price_data][product_data][name]', `Sponsor ${referer}`);
        params.append('line_items[0][quantity]', '1');
        
        params.append('mode', 'payment');
        
        params.append('success_url', `${referer}`);
        params.append('cancel_url', `${referer}`);

        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const data = await stripeResponse.json();

        if (!stripeResponse.ok) {
            console.error('Stripe Error:', data);
            return ctx.throws(stripeResponse.status || 500, data.error?.message || 'Stripe API Error');
        }

        return { url: data.url };

    } catch (error) {
        console.error('Handler Error:', error);
        return ctx.throws(500, error.message || 'Internal Server Error');
    }
}
