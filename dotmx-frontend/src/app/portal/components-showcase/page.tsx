"use client";

import { useState } from "react";
import {
  StatusBanner,
  StatusIndicator,
  Alert,
  GradientCard,
  GradientCardHeader,
  GradientCardTitle,
  GradientCardContent,
  GradientCardFooter,
  FeatureToggle,
  FeatureStatusCard,
  Input,
  Select,
  Textarea,
  Modal,
  ModalBody,
  ModalFooter,
  List,
  ListItem,
  ListItemBadge,
  Loader,
  ProgressBar,
  CircularProgress,
  InfoBox,
  CodeBox,
  StatsBox,
  Button,
} from "@/components/ui";
import {
  Shield,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Info,
  Smartphone,
  Lock,
  Key,
  Eye,
  EyeOff,
  Mail,
  Monitor,
  Trash2,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

export default function ComponentShowcase() {
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-7xl space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-white">
            DotMX Shared UI Components
          </h1>
          <p className="text-zinc-400">
            Reusable components from the Security Page design system
          </p>
        </div>

        {/* Status Banner */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Status Banner
          </h2>
          <StatusBanner
            variant="info"
            icon={Shield}
            title="Security Score"
            score={85}
            maxScore={100}
            description={
              <>
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Excellent! Your account is highly secure</span>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatusIndicator label="2FA" enabled={true} icon={Smartphone} />
              <StatusIndicator label="Password" enabled={true} icon={Lock} />
              <StatusIndicator label="Whitelist" enabled={false} icon={Key} />
              <StatusIndicator label="Sessions" enabled={true} icon={Monitor} />
            </div>
          </StatusBanner>
        </section>

        {/* Alerts */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">Alerts</h2>
          <div className="space-y-4">
            <Alert
              variant="success"
              icon={CheckCircle}
              title="Success!"
              message="Your password has been changed successfully."
            />
            <Alert
              variant="error"
              icon={AlertCircle}
              title="Error"
              message="Failed to update settings. Please try again."
            />
            <Alert
              variant="warning"
              icon={AlertTriangle}
              title="Warning"
              message="This action cannot be undone."
            />
            <Alert
              variant="info"
              icon={Info}
              title="Information"
              message="New features are available in your dashboard."
            />
          </div>
        </section>

        {/* Gradient Cards */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Gradient Cards
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <GradientCard variant="default" hover>
              <GradientCardHeader>
                <GradientCardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-400" />
                  Default Card
                </GradientCardTitle>
              </GradientCardHeader>
              <GradientCardContent>
                <p className="text-zinc-400">
                  This is a default gradient card with hover effect enabled.
                </p>
              </GradientCardContent>
              <GradientCardFooter>
                <Button variant="primary">Action</Button>
              </GradientCardFooter>
            </GradientCard>

            <GradientCard variant="success">
              <GradientCardHeader>
                <GradientCardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Success Card
                </GradientCardTitle>
              </GradientCardHeader>
              <GradientCardContent>
                <p className="text-zinc-400">
                  This is a success variant gradient card.
                </p>
              </GradientCardContent>
            </GradientCard>
          </div>
        </section>

        {/* Feature Toggles */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Feature Toggles
          </h2>
          <div className="space-y-4">
            <FeatureToggle
              icon={Smartphone}
              iconColor="text-emerald-400"
              title="Two-Factor Authentication"
              description="Add an extra layer of security to your account"
              enabled={is2FAEnabled}
              onToggle={() => setIs2FAEnabled(!is2FAEnabled)}
            />
            <FeatureStatusCard
              icon={Key}
              iconColor="text-blue-400"
              title="API Access"
              description="Enable API access for your applications"
              enabled={false}
              actionLabel="Enable API"
              onAction={() => alert("Enable API clicked")}
            />
          </div>
        </section>

        {/* Form Inputs */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Form Inputs
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Input
              label="Email Address"
              type="email"
              placeholder="your@email.com"
              icon={Mail}
              iconPosition="left"
              helperText="We'll never share your email"
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              icon={showPassword ? Eye : EyeOff}
              iconPosition="right"
              iconAction={() => setShowPassword(!showPassword)}
            />
            <Select
              label="Select Chain"
              options={[
                { value: "ETH", label: "Ethereum" },
                { value: "BSC", label: "Binance Smart Chain" },
                { value: "MATIC", label: "Polygon" },
              ]}
              variant="filled"
            />
            <Textarea
              label="Description"
              rows={4}
              placeholder="Enter description..."
              helperText="Max 500 characters"
            />
          </div>
        </section>

        {/* Lists */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">Lists</h2>
          <GradientCard>
            <GradientCardHeader>
              <GradientCardTitle>Active Sessions</GradientCardTitle>
            </GradientCardHeader>
            <GradientCardContent className="p-0">
              <List>
                <ListItem
                  icon={Monitor}
                  iconColor="text-blue-400"
                  title="Chrome on macOS"
                  description="Last active: 2 minutes ago"
                  metadata={
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">
                        San Francisco, US
                      </div>
                      <ListItemBadge label="Current" variant="success" />
                    </div>
                  }
                  actions={
                    <button className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
                <ListItem
                  icon={Monitor}
                  iconColor="text-zinc-400"
                  title="Firefox on Windows"
                  description="Last active: 1 hour ago"
                  metadata={
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">New York, US</div>
                    </div>
                  }
                  actions={
                    <button className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              </List>
            </GradientCardContent>
          </GradientCard>
        </section>

        {/* Progress Indicators */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Progress Indicators
          </h2>
          <div className="space-y-6">
            <div className="space-y-4">
              <ProgressBar
                value={75}
                max={100}
                variant="success"
                label="Upload Progress"
                showValue={true}
              />
              <ProgressBar
                value={45}
                max={100}
                variant="warning"
                label="Profile Completion"
                showValue={true}
              />
            </div>
            <div className="flex justify-center gap-8">
              <CircularProgress
                value={85}
                max={100}
                size={120}
                strokeWidth={8}
                variant="success"
                showValue={true}
                label="Score"
              />
              <CircularProgress
                value={60}
                max={100}
                size={120}
                strokeWidth={8}
                variant="warning"
                showValue={true}
                label="Health"
              />
            </div>
          </div>
        </section>

        {/* Info Boxes */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">Info Boxes</h2>
          <div className="space-y-4">
            <InfoBox variant="info" icon={Info} title="Important">
              Please save your API key securely. You won&apos;t be able to see
              it again.
            </InfoBox>
            <CodeBox
              label="API Key"
              code="sk_live_1234567890abcdef_this_is_your_api_key"
              onCopy={handleCopy}
              copied={isCopied}
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <StatsBox
                label="Total Volume"
                value="$1.2M"
                icon={TrendingUp}
                variant="success"
                trend={{ value: 12.5, direction: "up" }}
              />
              <StatsBox
                label="Active Users"
                value="2,543"
                icon={Monitor}
                variant="default"
                trend={{ value: 8.2, direction: "up" }}
              />
              <StatsBox
                label="Error Rate"
                value="0.3%"
                icon={AlertTriangle}
                variant="warning"
                trend={{ value: 2.1, direction: "down" }}
              />
            </div>
          </div>
        </section>

        {/* Modal Demo */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">Modal</h2>
          <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Confirm Action"
            description="This is a modal dialog example"
            size="md"
          >
            <ModalBody>
              <p className="text-zinc-400">
                Are you sure you want to perform this action? This is just a
                demo modal.
              </p>
              <Alert
                variant="warning"
                icon={AlertTriangle}
                message="This action cannot be undone."
                className="mt-4"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  alert("Confirmed!");
                  setIsModalOpen(false);
                }}
              >
                Confirm
              </Button>
            </ModalFooter>
          </Modal>
        </section>

        {/* Loaders */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-white">Loaders</h2>
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <Loader size="sm" />
              <span className="text-xs text-zinc-500">Small</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Loader size="md" />
              <span className="text-xs text-zinc-500">Medium</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Loader size="lg" />
              <span className="text-xs text-zinc-500">Large</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-zinc-800 pt-8 text-center">
          <p className="text-sm text-zinc-500">
            All components are reusable and follow the DotMX design system
          </p>
        </div>
      </div>
    </div>
  );
}
