'use client';

import { Check, X } from 'lucide-react';
import { Fragment } from 'react';
import { PricingCard } from '@/components/pricing-card';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'For open source projects and individual developers.',
    plan: 'free' as const,
    features: [
      { name: 'Public repos only', included: true },
      { name: '100 analyses/day', included: true },
      { name: 'Basic quality rules', included: true },
      { name: 'Badge endpoint', included: true },
      { name: 'GitHub Action', included: true },
      { name: 'Private repos', included: false },
      { name: 'AI doc generation', included: false },
    ],
    cta: 'Get Started',
  },
  {
    name: 'Team',
    price: '$15',
    period: '/user/mo',
    description: 'For teams shipping documented APIs.',
    plan: 'team' as const,
    highlighted: true,
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Private repos', included: true },
      { name: '1,000 analyses/day', included: true },
      { name: 'Coverage trends', included: '30 days' },
      { name: 'AI doc generation', included: '200 calls/user/mo' },
      { name: 'BYOK for unlimited AI', included: true },
      { name: 'All quality rules', included: true },
    ],
    cta: 'Start Team Trial',
  },
  {
    name: 'Pro',
    price: '$30',
    period: '/user/mo',
    description: 'For orgs with strict documentation standards.',
    plan: 'pro' as const,
    features: [
      { name: 'Everything in Team', included: true },
      { name: '10,000 analyses/day', included: true },
      { name: 'Coverage trends', included: '90 days' },
      { name: 'AI doc generation', included: '500 calls/user/mo' },
      { name: 'Per-path policies', included: true },
      { name: 'CODEOWNERS integration', included: true },
      { name: 'Slack & webhooks', included: true },
      { name: 'Custom quality rules', included: true },
    ],
    cta: 'Start Pro Trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large orgs with compliance needs.',
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Unlimited analyses', included: true },
      { name: 'SSO/SAML', included: true },
      { name: 'Self-hosted option', included: true },
      { name: 'SLA guarantee', included: true },
      { name: 'Dedicated support', included: true },
    ],
    cta: 'Contact Sales',
  },
];

const comparisonFeatures = [
  {
    category: 'Usage',
    features: [
      { name: 'Public repos', free: true, team: true, pro: true },
      { name: 'Private repos', free: false, team: true, pro: true },
      { name: 'Daily analyses', free: '100', team: '1,000', pro: '10,000' },
    ],
  },
  {
    category: 'AI Features',
    features: [
      { name: 'AI doc generation', free: false, team: '200/user/mo', pro: '500/user/mo' },
      { name: 'BYOK unlimited', free: false, team: true, pro: true },
    ],
  },
  {
    category: 'Analytics',
    features: [
      { name: 'Coverage trends', free: false, team: '30 days', pro: '90 days' },
      { name: 'Per-contributor stats', free: false, team: false, pro: true },
    ],
  },
  {
    category: 'Quality Rules',
    features: [
      { name: 'Basic rules', free: true, team: true, pro: true },
      { name: 'All built-in rules', free: false, team: true, pro: true },
      { name: 'Custom rules', free: false, team: false, pro: true },
    ],
  },
  {
    category: 'Governance',
    features: [
      { name: 'Per-path policies', free: false, team: false, pro: true },
      { name: 'CODEOWNERS integration', free: false, team: false, pro: true },
    ],
  },
  {
    category: 'Integrations',
    features: [
      { name: 'GitHub Action', free: true, team: true, pro: true },
      { name: 'Badge endpoint', free: true, team: true, pro: true },
      { name: 'Slack notifications', free: false, team: false, pro: true },
      { name: 'Webhooks', free: false, team: false, pro: true },
    ],
  },
];

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-success" />;
  if (value === false) return <X className="mx-auto h-5 w-5 text-muted-foreground/50" />;
  return <span className="text-sm">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple, per-seat pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start free with public repos. Upgrade for private repos, AI generation, and team features.
        </p>
      </div>

      {/* Tier Cards */}
      <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} {...tier} />
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="mx-auto mt-20 max-w-5xl">
        <h2 className="mb-8 text-center text-2xl font-bold">Feature comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="pb-4 pr-4 font-medium">Feature</th>
                <th className="pb-4 px-4 text-center font-medium">Free</th>
                <th className="pb-4 px-4 text-center font-medium">Team</th>
                <th className="pb-4 pl-4 text-center font-medium">Pro</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((category) => (
                <Fragment key={category.category}>
                  <tr className="border-b bg-muted/30">
                    <td
                      colSpan={4}
                      className="py-2 px-2 text-sm font-semibold text-muted-foreground"
                    >
                      {category.category}
                    </td>
                  </tr>
                  {category.features.map((feature) => (
                    <tr key={feature.name} className="border-b">
                      <td className="py-3 pr-4 text-sm">{feature.name}</td>
                      <td className="py-3 px-4 text-center">
                        <FeatureCell value={feature.free} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <FeatureCell value={feature.team} />
                      </td>
                      <td className="py-3 pl-4 text-center">
                        <FeatureCell value={feature.pro} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ or CTA */}
      <div className="mx-auto mt-20 max-w-2xl text-center">
        <h2 className="text-2xl font-bold">Questions?</h2>
        <p className="mt-4 text-muted-foreground">
          AI calls are pooled across your org. When you hit the limit, set your own API key (BYOK)
          for unlimited generation—you pay the provider directly.
        </p>
        <p className="mt-4">
          <a href="mailto:hello@doccov.com" className="text-primary underline underline-offset-4">
            Contact us
          </a>{' '}
          for volume discounts or custom requirements.
        </p>
      </div>
    </div>
  );
}
