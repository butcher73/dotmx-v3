import { Layout } from "@/components/common";

export default function RiskDisclosurePage() {
  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Risk Disclosure</span>
          </h1>
          <p className="text-xl leading-relaxed text-[#A3B8D9]">
            Important information about trading risks
          </p>
        </div>

        <div className="mb-12 rounded-3xl border border-red-600/30 bg-linear-to-r from-red-900/20 to-orange-900/20 p-12">
          <h2 className="mb-8 text-center text-4xl font-bold text-red-400">
            ⚠️ Important Risk Warning
          </h2>
          <div className="mb-8 text-center">
            <p className="mb-6 text-xl text-[#A3B8D9]">
              Trading digital assets involves substantial risk of loss and may
              not be suitable for all investors.
            </p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold text-red-400">
              General Risk Factors
            </h3>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                • <strong>Market Volatility:</strong> Digital asset prices can
                be extremely volatile and may fluctuate significantly in short
                periods
              </li>
              <li>
                • <strong>Loss of Capital:</strong> You may lose some or all of
                your invested capital
              </li>
              <li>
                • <strong>Regulatory Risk:</strong> Changes in regulations may
                impact the value and tradability of digital assets
              </li>
              <li>
                • <strong>Technology Risk:</strong> Technical issues, hacks, or
                smart contract vulnerabilities may result in losses
              </li>
              <li>
                • <strong>Liquidity Risk:</strong> You may not be able to sell
                your positions when desired
              </li>
              <li>
                • <strong>Counterparty Risk:</strong> Risk associated with the
                platform or other trading parties
              </li>
            </ul>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold text-red-400">
              DeFi-Specific Risks
            </h3>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                • <strong>Smart Contract Risk:</strong> Bugs or vulnerabilities
                in smart contracts may lead to loss of funds
              </li>
              <li>
                • <strong>Protocol Risk:</strong> Risks associated with the
                underlying DeFi protocols
              </li>
              <li>
                • <strong>Impermanent Loss:</strong> Potential losses from
                providing liquidity in automated market makers
              </li>
              <li>
                • <strong>Flash Loan Attacks:</strong> Risks from complex DeFi
                exploits and attacks
              </li>
              <li>
                • <strong>Governance Risk:</strong> Changes in protocol
                governance may affect your positions
              </li>
              <li>
                • <strong>Composability Risk:</strong> Risks from interactions
                between multiple DeFi protocols
              </li>
            </ul>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold text-red-400">
              Leverage and Margin Trading Risks
            </h3>
            <div className="mb-6 rounded-2xl border border-red-600/30 bg-red-900/20 p-6">
              <h4 className="mb-3 text-lg font-bold text-red-400">
                High Risk Warning
              </h4>
              <p className="text-[#A3B8D9]">
                Leverage trading can amplify both gains and losses. You may lose
                more than your initial investment.
              </p>
            </div>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                • <strong>Amplified Losses:</strong> Leverage magnifies both
                profits and losses
              </li>
              <li>
                • <strong>Liquidation Risk:</strong> Positions may be
                automatically closed if losses exceed margin
              </li>
              <li>
                • <strong>Funding Costs:</strong> Ongoing costs for maintaining
                leveraged positions
              </li>
              <li>
                • <strong>Gap Risk:</strong> Market gaps may result in losses
                exceeding account balance
              </li>
            </ul>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold text-orange-400">
              Risk Management Recommendations
            </h3>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>• Only invest what you can afford to lose</li>
              <li>
                • Diversify your investments across different assets and
                strategies
              </li>
              <li>• Use stop-loss orders to limit potential losses</li>
              <li>• Start with small position sizes when learning</li>
              <li>• Keep up to date with market news and developments</li>
              <li>• Understand the platforms and protocols you are using</li>
              <li>• Consider consulting with financial advisors</li>
            </ul>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold text-yellow-400">
              Before You Trade
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              Before engaging in trading activities, please ensure you:
            </p>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                • Understand the nature and risks of digital asset trading
              </li>
              <li>• Have carefully read and understood our Terms of Service</li>
              <li>• Are aware of the tax implications in your jurisdiction</li>
              <li>• Have the financial means to bear the risks</li>
              <li>
                • Understand that past performance does not guarantee future
                results
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">Regulatory Notice</span>
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              This risk disclosure is provided for informational purposes and
              does not constitute financial advice. Regulations regarding
              digital assets vary by jurisdiction. Please ensure you comply with
              all applicable laws and regulations in your area.
            </p>
            <p className="text-[#A3B8D9]">
              For questions about risks or trading policies, contact us at:{" "}
              <span className="font-semibold text-white">risk@dotmx.com</span>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
