import { AgentAuthForm } from "@/components/AgentAuthForm";
import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRedirectSignedInVisitor } from "@/lib/signedInWorkspace";

// The shared form owns agentPhoneDemo.useMutation and the visible
// "رمز واتساب التجريبي: 123456" demo copy for both page and modal flows.
export default function AgentLogin() {
  const { isEnglish } = useLanguage();
  const signedIn = useRedirectSignedInVisitor(isEnglish);
  if (signedIn) return null;
  return <AgentAuthForm variant="page" />;
}
