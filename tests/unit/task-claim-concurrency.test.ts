type ClaimState = {
  availableSlots: number;
  claimedSlots: number;
  claimIds: string[];
};

function createOptimisticClaimSimulator(initialSlots: number) {
  const state: ClaimState = {
    availableSlots: initialSlots,
    claimedSlots: 0,
    claimIds: [],
  };

  return {
    state,
    async claim(workerId: string) {
      await Promise.resolve();

      if (state.claimIds.includes(workerId) || state.availableSlots <= 0) {
        return { ok: false };
      }

      state.availableSlots -= 1;
      state.claimedSlots += 1;
      state.claimIds.push(workerId);

      return { ok: true };
    },
  };
}

describe("slot claiming concurrency", () => {
  it("không cấp quá số slot khi nhiều worker claim song song", async () => {
    const simulator = createOptimisticClaimSimulator(3);
    const attempts = Array.from({ length: 20 }, (_, index) =>
      simulator.claim(`worker-${index}`),
    );

    const results = await Promise.all(attempts);

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(simulator.state.availableSlots).toBe(0);
    expect(simulator.state.claimedSlots).toBe(3);
  });

  it("không cho cùng một worker giữ hai slot của cùng một task", async () => {
    const simulator = createOptimisticClaimSimulator(2);
    const results = await Promise.all([
      simulator.claim("worker-1"),
      simulator.claim("worker-1"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(simulator.state.claimedSlots).toBe(1);
  });
});
