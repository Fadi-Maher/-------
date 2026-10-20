import { AgentAuthForm } from "@/components/AgentAuthForm";
import React from "react";

// The shared form owns agentPhoneDemo.useMutation and the visible
// "رمز واتساب التجريبي: 123456" demo copy for both page and modal flows.
export default function AgentLogin() {
  return <AgentAuthForm variant="page" />;
}
