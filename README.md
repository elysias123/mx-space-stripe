添加[云函数](functions/stripe.ts)

名称: checkout
引用: stripe
数据类型: Function
请求方式: POST
Secret：key 你的stripe api密钥


![image](img/image.png)

### example：
```html

    <input type="number" id="amount" placeholder="金额 (元)" value="5" min="5" step="0.01">
    <button id="payBtn">支付</button>

    <script>
        const btn = document.getElementById('payBtn');
        const input = document.getElementById('amount');
        
        // 你的云函数地址
        const API_URL = 'https://example.com/api/v2/fn/stripe/checkout';

        btn.onclick = async () => {
            btn.disabled = true;
            btn.innerText = '跳转中...';

            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: input.value })
                });

                const data = await res.json();

                if (data.url) {
                    window.location.href = data.url;
                } else {
                    alert('错误: ' + (data.error || data.message || '未获取到支付链接'));
                    btn.disabled = false;
                    btn.innerText = '支付';
                }
            } catch (e) {
                alert('网络或接口异常: ' + e.message);
                btn.disabled = false;
                btn.innerText = '支付';
            }
        };
    </script>
```
