"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { PortalPageLayout, PortalPageHeader } from "@/components/ui";
import {
  SecurityOverviewBanner,
  UserProfileCard,
  QuickActionsCard,
  TwoFactorAuthCard,
  PasswordCard,
  WhitelistCard,
  SessionsCard,
} from "./components";
import { getDeviceInfo, calculateSecurityScore } from "./utils";
import { usePassword, useTwoFactor, useWhitelist, useSessions } from "./hooks";

export default function SecurityPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Custom hooks for state management
  const password = usePassword();
  const twoFactor = useTwoFactor(isAuthenticated);
  const whitelist = useWhitelist(isAuthenticated);
  const sessionsMgmt = useSessions(isAuthenticated);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  // Calculate security score
  const securityScore = calculateSecurityScore(
    user?.email_verified || false,
    twoFactor.twoFactorStatus?.enabled || false,
    whitelist.whitelistEnabled,
    !!password.passwordForm.current || sessionsMgmt.sessions.length > 0
  );

  if (authLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="mb-2 h-8 w-48 animate-pulse rounded bg-zinc-800/50" />
          <div className="h-5 w-96 animate-pulse rounded bg-zinc-800/50" />
        </div>
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Security & Privacy"
        description="Protect your account and assets with advanced security features"
      />

      {/* Security Overview Banner */}
      <SecurityOverviewBanner
        score={securityScore.score}
        factors={securityScore.factors}
      />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Column 1 */}
        <div className="space-y-6">
          <UserProfileCard
            user={
              user
                ? {
                    email: user.email,
                    username: user.username || "",
                    email_verified: user.email_verified,
                  }
                : { email: "", username: "", email_verified: false }
            }
            sessionsCount={sessionsMgmt.sessions.length}
            whitelistCount={whitelist.whitelistAddresses.length}
          />
          <QuickActionsCard
            twoFactorEnabled={twoFactor.twoFactorStatus?.enabled || false}
            whitelistEnabled={whitelist.whitelistEnabled}
            onEnable2FA={twoFactor.handleStart2FASetup}
            onEnableWhitelist={whitelist.handleToggleWhitelist}
            onChangePassword={() => password.setShowChangePassword(true)}
          />
        </div>

        {/* Column 2 */}
        <div className="space-y-6">
          <TwoFactorAuthCard
            twoFactorStatus={twoFactor.twoFactorStatus}
            isLoading={twoFactor.isLoading2FA}
            message={twoFactor.twoFAMessage}
            show2FASetup={twoFactor.show2FASetup}
            show2FADisable={twoFactor.show2FADisable}
            showBackupCodes={twoFactor.showBackupCodes}
            setupData={twoFactor.setupData}
            verificationCode={twoFactor.verificationCode}
            isVerifying={twoFactor.isVerifying2FA}
            disablePassword={twoFactor.disablePassword}
            isDisabling={twoFactor.isDisabling2FA}
            copiedCode={twoFactor.copiedCode}
            onStart2FASetup={twoFactor.handleStart2FASetup}
            setShow2FASetup={twoFactor.setShow2FASetup}
            setShow2FADisable={twoFactor.setShow2FADisable}
            setShowBackupCodes={twoFactor.setShowBackupCodes}
            setVerificationCode={twoFactor.setVerificationCode}
            onVerify2FA={twoFactor.handleVerify2FA}
            setDisablePassword={twoFactor.setDisablePassword}
            onDisable2FA={twoFactor.handleDisable2FA}
            onCopyToClipboard={twoFactor.copyToClipboard}
          />
          <PasswordCard
            showChangePassword={password.showChangePassword}
            passwordForm={password.passwordForm}
            passwordVisibility={password.passwordVisibility}
            passwordStrength={password.passwordStrength}
            isChangingPassword={password.isChangingPassword}
            message={password.passwordMessage}
            onPasswordFormChange={password.handlePasswordFormChange}
            onPasswordVisibilityToggle={password.handlePasswordVisibilityToggle}
            onChangePassword={password.handleChangePassword}
            onShowChangePassword={password.setShowChangePassword}
          />
        </div>

        {/* Column 3 */}
        <div className="space-y-6">
          <WhitelistCard
            whitelistEnabled={whitelist.whitelistEnabled}
            whitelistAddresses={whitelist.whitelistAddresses}
            isLoading={whitelist.isLoadingWhitelist}
            message={whitelist.whitelistMessage}
            showAddAddress={whitelist.showAddAddress}
            newAddress={whitelist.newAddress}
            isAddingAddress={whitelist.isAddingAddress}
            onToggleWhitelist={whitelist.handleToggleWhitelist}
            onShowAddAddress={whitelist.setShowAddAddress}
            onNewAddressChange={whitelist.handleNewAddressChange}
            onAddAddress={whitelist.handleAddAddress}
            onRemoveAddress={whitelist.handleRemoveAddress}
          />
          <SessionsCard
            sessions={sessionsMgmt.sessions}
            isLoading={sessionsMgmt.isLoadingSessions}
            sessionsPage={sessionsMgmt.sessionsPage}
            sessionsPerPage={sessionsMgmt.sessionsPerPage}
            getDeviceInfo={getDeviceInfo}
            onSetSessionsPage={sessionsMgmt.setSessionsPage}
            onRevokeSession={sessionsMgmt.handleRevokeSession}
          />
        </div>
      </div>
    </PortalPageLayout>
  );
}
