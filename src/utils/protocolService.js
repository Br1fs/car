// utils/protocolService.js

let localCounter = 528; // временно, потом backend

export function getNextProtocolNumber() {
  localCounter += 1;
  return String(localCounter).padStart(4, "0");
}