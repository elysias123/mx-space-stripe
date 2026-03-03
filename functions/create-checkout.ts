export default async function handler(ctx: any) {
    const { req } = ctx;
    const Stripe = await require('stripe');

    const fail = (status: number, message: string) => {
        if (typeof ctx.status !== 'undefined') ctx.status = status;
        else if (ctx.res) ctx.res.statusCode = status;
        return { ok: 0, message };
    };

    const currentHost = req.headers['x-forwarded-host'] || req.headers['host'];
    
    // 定义允许调用的域名白名单 (不带协议 http://)
    const ALLOWED_DOMAINS = [
        'localhost',
        '127.0.0.1'
    ];

    const DOMAIN_VERIFICATION = true; // 是否启用域名验证


    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    const secFetchMode = String(req.headers['sec-fetch-mode'] || '').toLowerCase();

    const isDirectBrowserNavigation = secFetchMode === 'navigate';
    const hasCallerContext = Boolean(origin || referer);
    if (isDirectBrowserNavigation || !hasCallerContext) {
        return fail(405, 'Method Not Allowed: This endpoint is intended for server-to-server communication only.');
    }

    if (!ctx.secret || !ctx.secret.key) {
        return fail(500, 'Missing Stripe Secret Key');
    }

    const stripe = new Stripe(ctx.secret.key);

    let requestDomain = null;
    const protocol = req.headers['x-forwarded-proto'] || (String(currentHost).includes('localhost') ? 'http' : 'https');

    const toAbsoluteUrl = (value: string | undefined | null) => {
        if (!value) return null;
        try {
            return new URL(value).toString();
        } catch (e) {
            try {
                return new URL(`${protocol}://${value}`).toString();
            } catch (error) {
                return null;
            }
        }
    };

    const fallbackUrl = toAbsoluteUrl(referer) || toAbsoluteUrl(origin) || toAbsoluteUrl(currentHost);
    const requestedReturnUrl = req.body?.return_url || req.query?.return_url || null;
    const requestedSuccessUrl = req.body?.success_url || req.query?.success_url || null;
    const requestedCancelUrl = req.body?.cancel_url || req.query?.cancel_url || null;
    const returnUrl =
        toAbsoluteUrl(requestedReturnUrl) ||
        toAbsoluteUrl(requestedSuccessUrl) ||
        toAbsoluteUrl(requestedCancelUrl) ||
        fallbackUrl;

    try {
        const parsedOrigin = toAbsoluteUrl(origin);
        const parsedReferer = toAbsoluteUrl(referer);
        if (parsedOrigin) requestDomain = new URL(parsedOrigin).host;
        else if (parsedReferer) requestDomain = new URL(parsedReferer).host;
    } catch (e) {}

    if (DOMAIN_VERIFICATION && requestDomain && !ALLOWED_DOMAINS.includes(requestDomain)) {
        return fail(403, `Forbidden: Domain '${requestDomain}' is not allowed.`);
    }

    if (!returnUrl) {
        return fail(400, 'Invalid return URL');
    }

    const amount = req.body?.amount || req.query?.amount || null;
    const currencyInput = req.body?.currency || req.query?.currency || 'cny';
    const currency = String(currencyInput).toLowerCase();
    const inputAmount = Number(amount);

    if (!Number.isFinite(inputAmount)) {
        return fail(400, 'Invalid amount format');
    }

    const amountInCents = String(Math.round(inputAmount * 100));

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            adaptive_pricing: {
                enabled: true
            },
            line_items: [
                {
                    price_data: {
                        currency,
                        unit_amount: Number(amountInCents),
                        product_data: {
                            name: `Sponsor ${referer}`
                        }
                    },
                    quantity: 1
                }
            ],
            success_url: returnUrl,
            cancel_url: returnUrl
        });

        return { url: session.url };

    } catch (error: any) {
        console.error('Handler Error:', error);
        return fail(500, error?.message || 'Internal Server Error');
    }
}
