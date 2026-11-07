import { http, createConfig, injected } from "wagmi";
import { mezoTestnet } from "./mezo";

export { mezoTestnet, CONTRACT_ADDRESSES } from "./mezo";

export const wagmiConfig = createConfig({
  chains: [mezoTestnet],
  connectors: [injected()],
  transports: { [mezoTestnet.id]: http(mezoTestnet.rpcUrls.default.http[0]) },
  ssr: true,
});
