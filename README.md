# Stock Momentum

### Stock Momentum Extension
Trader Sync is a site that allows you to record past stock market transactions so that the trader can review and learn from their past mistakes. However, many traders make hundreds of trades a day, which can become tedious. Enter Stock Momentum Extension, a chrome extension that uses the power of ✨ ***machine learning*** ✨ to make the reviewing process painless.

#### Using Stock Momentum Extension
1. Open Google chrome extensions
2. Turn on developer mode
3. Click on Load Unpacked
4. Select the StockMomentumExtension folder

#### Building Stock Momentum Extension

```
    npx browserify StockMomentumExtension/index.js -o StockMomentumExtension/bundle.js
```

#### Running Tests
```
    node StockMomentumExtension/tests/run_tests.js
```