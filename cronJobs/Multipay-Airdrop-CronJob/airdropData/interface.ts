export type SubscriptionInfo = {
  address: string;
  product: string;
  subscriptions: Subscription[];
};

export type Subscription = {
  user: {
    address: string;
  };
  contract: {
    address: string;
  };
};

export type Stream = {
  id: string;
  streamId: string;
  amountPerSec: number;
  starts: number;
  ends: number;
  active: boolean;
  payer: {
    address: string;
  };
  payee: {
    address: string;
  };
  contract: {
    address: string;
  };
};

export type StreamParam = {
  payContract: string;
  from: string;
  to: string;
  amountPerSec: number;
  starts: number;
  ends: number;
};

export type Airdrop = {
  from: string;
  tos: string[];
  amountPerRecipient: number;
  releaseTime: number;
  status: AirdropStatus;
  fee: number;
};

enum AirdropStatus {
  InProgress,
  Completed,
  Cancelled,
}

export type SubscriptionsData = any;
export type StreamData = any;
