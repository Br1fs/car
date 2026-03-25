export const protocolPdfLayouts = {
  m1_benz: {
    page1: {
      rightColumn: {
        x: 366,
        startY: 575,
        step: 15,

        defaultSize: 6,
        yearSize: 6,
        fioSize: 6,
        addressSize: 6,

        wrapMaxWidth: 170,
        addressMaxWidth: 165,

        afterFirstDateGap: 0.01,
        afterSecondDateGap: 2,
        afterFioGap: 0.4,
        afterAddressGap: 0.8,
      },
      protocolNumber: { x: 430, y: 637, size: 7, boldOffsetX: 0.3 },
      protocolDate: { x: 270, y: 626, size: 7, boldOffsetX: 0.3 },

      conditions: {
        x: 448,
        temperatureY: 268,
        humidityY: 257,
        pressureY: 145,
        size: 5,
      },

      manufacturer: { x: 366, y: 360, size: 7 },
      manufacturerAddress: { x: 366, y: 350, size: 6, maxWidth: 160, lineGap: 1 },

      assemblyPlant: { x: 366, y: 319, size: 7 },
      assemblyPlantAddress: { x: 366, y: 310, size: 6, maxWidth: 165, lineGap: 1 },
    },

    page2: {
      extraEquipment: { x: 380, y: 200, maxWidth: 158, size: 6 },
    },

    page4: {
      r1: { x: 505, y: 261, size: 6.5 },
      r2: { x: 505, y: 238, size: 6.5 },
      r3: { x: 505, y: 203, size: 6.5 },
      r4: { x: 505, y: 167, size: 6.5 },
      r5: { x: 505, y: 146, size: 6.5 },
    },

    page5: {
      r1: { x: 450, y: 757, size: 6.5 },
      r2: { x: 504, y: 721, size: 6.5 },
      r3: { x: 504, y: 694, size: 6.5 },
      r4: { x: 504, y: 557, size: 6.5 },
      r5: { x: 504, y: 536, size: 6.5 },
      r6: { x: 445, y: 516, size: 6.5 },
      r7: { x: 450, y: 488, size: 6.5 },
    },

    page6: {
      r1: { x: 450, y: 776, size: 6.5 },
      r2: { x: 450, y: 690, size: 6.5 },
      r3: { x: 450, y: 405, size: 6.5 },
      r4: { x: 450, y: 541, size: 6.5 },
      r5: { x: 450, y: 251, size: 6.5 },
    },

    page9: {
      year: { x: 440, y: 676, size: 6.5 },
      yearSuffix: { x: 456, y: 676, size: 6.5 },
      coMin: { x: 450, y: 248, size: 6.5 },
      coMax: { x: 450, y: 210, size: 6.5 },
      smoke: { x: 450, y: 248, size: 6.5 },
    },

    page10: {
      length: { x: 450, y: 394, size: 7 },
      width: { x: 450, y: 356, size: 7 },
      height: { x: 450, y: 315, size: 7 },
    },

    page11: {
      noise: { x: 450, y: 242, size: 6.5 },
      r1: { x: 505, y: 599, size: 6.5 },
      r2: { x: 505, y: 563, size: 6.5 },
    },
  },

  m1_diesel: {
    page1: {
      rightColumn: {
        x: 366,
        startY: 575,
        step: 15,

        defaultSize: 6,
        yearSize: 6,
        fioSize: 6,
        addressSize: 6,

        wrapMaxWidth: 170,
        addressMaxWidth: 165,

        afterFirstDateGap: 0.01,
        afterSecondDateGap: 2.6,
        afterFioGap: 0.2,
        afterAddressGap: 0.8,
      },

      protocolNumber: { x: 430, y: 637, size: 7, boldOffsetX: 0.3 },
      protocolDate: { x: 270, y: 626, size: 7, boldOffsetX: 0.3 },

      conditions: {
        x: 448,
        temperatureY: 268,
        humidityY: 257,
        pressureY: 145,
        size: 5,
      },

      manufacturer: { x: 366, y: 360, size: 7 },
      manufacturerAddress: { x: 366, y: 349, size: 6, maxWidth: 160, lineGap: 1 },

      assemblyPlant: { x: 366, y: 319, size: 7 },
      assemblyPlantAddress: { x: 366, y: 309, size: 6, maxWidth: 165, lineGap: 1 },
    },

    page2: {
      extraEquipment: { x: 377, y: 163, maxWidth: 157, size: 6 },
    },

    page4: {
      r1: { x: 505, y: 257, size: 6.5 },
      r2: { x: 505, y: 234, size: 6.5 },
      r3: { x: 505, y: 202, size: 6.5 },
      r4: { x: 505, y: 169, size: 6.5 },
      r5: { x: 505, y: 149, size: 6.5 },
    },

    page5: {
      r1: { x: 450, y: 757, size: 6.5 },
      r2: { x: 504, y: 715, size: 6.5 },
      r3: { x: 504, y: 677, size: 6.5 },
      r4: { x: 504, y: 535, size: 6.5 },
      r5: { x: 504, y: 509, size: 6.5 },
      r6: { x: 445, y: 482, size: 6.5 },
      r7: { x: 450, y: 455, size: 6.5 },
    },

    page6: {
      r1: { x: 448, y: 775, size: 6.5 },
      r2: { x: 450, y: 688, size: 6.5 },
      r3: { x: 450, y: 402, size: 6.5 },
      r4: { x: 450, y: 538, size: 6.5 },
      r5: { x: 450, y: 247, size: 6.5 },
    },

    page9: {
      year: { x: 440, y: 675, size: 6.5 },
      yearSuffix: { x: 456, y: 675, size: 6.5 },
      coMin: { x: 450, y: 248, size: 6.5 },
      coMax: { x: 450, y: 210, size: 6.5 },
      smoke: { x: 450, y: 238, size: 6.5 },
    },

    page10: {
      length: { x: 450, y: 385, size: 7 },
      width: { x: 450, y: 348, size: 7 },
      height: { x: 450, y: 314, size: 7 },
    },

    page11: {
      noise: { x: 450, y: 357, size: 6.5 },
      r1: { x: 505, y: 614, size: 6.5 },
      r2: { x: 505, y: 586, size: 6.5 },
    },
  },

  m1_electro: {
    page1: {
      rightColumn: {
        x: 368,
        startY: 572,
        step: 15.3,

        defaultSize: 6,
        yearSize: 6,
        fioSize: 6,
        addressSize: 6,

        wrapMaxWidth: 170,
        addressMaxWidth: 165,

        afterFirstDateGap: 0.01,
        afterSecondDateGap: 2.3,
        afterFioGap: 0.2,
        afterAddressGap: 0.8,
      },
      protocolNumber: { x: 430, y: 637, size: 7, boldOffsetX: 0.3 },
      protocolDate: { x: 270, y: 626, size: 7, boldOffsetX: 0.3 },

      conditions: {
        x: 448,
        temperatureY: 268,
        humidityY: 257,
        pressureY: 145,
        size: 5,
      },

      manufacturer: { x: 368, y: 360, size: 7 },
      manufacturerAddress: { x: 368, y: 349, size: 6, maxWidth: 160, lineGap: 1 },

      assemblyPlant: { x: 368, y: 319, size: 7 },
      assemblyPlantAddress: { x: 368, y: 309, size: 6, maxWidth: 165, lineGap: 1 },
    },

    page2: {
      extraEquipment: { x: 377, y: 180, maxWidth: 157, size: 6 },
    },

    page4: {
      r1: { x: 505, y: 255, size: 6.5 },
      r2: { x: 505, y: 233, size: 6.5 },
      r3: { x: 505, y: 202, size: 6.5 },
      r4: { x: 505, y: 172, size: 6.5 },
      r5: { x: 505, y: 153, size: 6.5 },
    },

    page5: {
      r1: { x: 450, y: 757, size: 6.5 },
      r2: { x: 504, y: 715, size: 6.5 },
      r3: { x: 504, y: 677, size: 6.5 },
      r4: { x: 504, y: 535, size: 6.5 },
      r5: { x: 504, y: 509, size: 6.5 },
      r6: { x: 445, y: 485, size: 6.5 },
      r7: { x: 450, y: 459, size: 6.5 },
    },

    page6: {
      r1: { x: 448, y: 775, size: 6.5 },
      r2: { x: 450, y: 688, size: 6.5 },
      r3: { x: 450, y: 402, size: 6.5 },
      r4: { x: 450, y: 538, size: 6.5 },
      r5: { x: 450, y: 247, size: 6.5 },
    },

    page9: {
      year: { x: 440, y: 670, size: 6.5 },
      yearSuffix: { x: 456, y: 670, size: 6.5 },
      coMin: { x: 450, y: 248, size: 6.5 },
      coMax: { x: 450, y: 210, size: 6.5 },
      smoke: { x: 450, y: 238, size: 6.5 },
    },

    page10: {
      length: { x: 450, y: 373, size: 7 },
      width: { x: 450, y: 334, size: 7 },
      height: { x: 450, y: 295, size: 7 },
    },

    page11: {
      noise: { x: 450, y: 357, size: 6.5 },
      r1: { x: 505, y: 614, size: 6.5 },
      r2: { x: 505, y: 591, size: 6.5 },
    },
  },

  // N3 дизель: грузовой и седельный используют один и тот же layout
n3_diesel_sedelnyi: {
  page1: {
    rightColumn: {
      x: 358,
      startY: 573,
      step: 15.3,

      defaultSize: 6,
      yearSize: 6,
      fioSize: 6,
      addressSize: 6,

      wrapMaxWidth: 170,
      addressMaxWidth: 165,

      afterFirstDateGap: 0.01,
      afterSecondDateGap: 2.5,
      afterFioGap: 0.1,
      afterAddressGap: 1.8,
    },
    protocolNumber: { x: 430, y: 637, size: 7, boldOffsetX: 0.3 },
    protocolDate: { x: 270, y: 626, size: 7, boldOffsetX: 0.3 },

    conditions: {
      x: 442,
      temperatureY: 266,
      humidityY: 255,
      pressureY: 140,
      size: 5,
    },

    manufacturer: { x: 358, y: 360, size: 7 },
    manufacturerAddress: { x: 358, y: 350, size: 6, maxWidth: 160, lineGap: 1 },

    assemblyPlant: { x: 358, y: 320, size: 7 },
    assemblyPlantAddress: { x: 358, y: 310, size: 6, maxWidth: 165, lineGap: 1 },
  },

  page2: {
    extraEquipment: { x: 377, y: 205, maxWidth: 157, size: 6 },
  },

  // N3: 4 страница = 9 значений
  page4: {
    r1: { x: 505, y: 703, size: 6.5 },
    r2: { x: 505, y: 680, size: 6.5 },
    r3: { x: 445, y: 590, size: 6.5 },
    r4: { x: 505, y: 542, size: 6.5 },
    r5: { x: 505, y: 500, size: 6.5 },

    r6: { x: 504, y: 345, size: 6.5 },
    r7: { x: 504, y: 318, size: 6.5 },
    r8: { x: 435, y: 290, size: 6.5 },
    r9: { x: 445, y: 262, size: 6.5 },
  },

  // N3: 5 страница = 5 значений
  page5: {
    r1: { x: 445, y: 471, size: 6.5 },
    r2: { x: 445, y: 448, size: 6.5 },
    // r3: { x: 450, y: 420, size: 6.5 },
    r4: { x: 445, y: 379, size: 6.5 },
    r5: { x: 445, y: 176, size: 6.5 },
  },

  // N3: 6 страница = 2 значения
  page6: {
    r1: { x: 445, y: 648, size: 6.5 },
    r2: { x: 445, y: 477, size: 6.5 },
  },

  // N3: 10 страница = дым
  page10: {
    year: { x: 434, y: 762, size: 6.5 },
    yearSuffix: { x: 448, y: 762, size: 6.5 },
    smoke: { x: 450, y: 277, size: 6.5 },
  },

  // N3: 12 страница = габариты
  page12: {
    length: { x: 443, y: 763, size: 7 },
    width: { x: 444, y: 724, size: 7 },
    height: { x: 445, y: 683, size: 7 },
  },

  // N3: 13 страница = шум
  page13: {
    noise: { x: 440, y: 776, size: 6.5 },
    // r1: { x: 505, y: 614, size: 6.5 },
    // r2: { x: 505, y: 586, size: 6.5 },
  },
},

n3_diesel_gruzovoi: {
  page1: {
    rightColumn: {
      x: 358,
      startY: 579,
      step: 15.3,

      defaultSize: 6,
      yearSize: 6,
      fioSize: 6,
      addressSize: 6,

      wrapMaxWidth: 170,
      addressMaxWidth: 168,

      afterFirstDateGap: 0.01,
      afterSecondDateGap: 2.4,
      afterFioGap: 0.3,
      afterAddressGap: 1.8,
    },
    protocolNumber: { x: 430, y: 638, size: 7, boldOffsetX: 0.3 },
    protocolDate: { x: 270, y: 627, size: 7, boldOffsetX: 0.3 },

    conditions: {
      x: 442,
      temperatureY: 270,
      humidityY: 260,
      pressureY: 140,
      size: 5,
    },

    manufacturer: { x: 358, y: 360, size: 7 },
    manufacturerAddress: { x: 358, y: 350, size: 6, maxWidth: 168, lineGap: 1 },

    assemblyPlant: { x: 358, y: 320, size: 7 },
    assemblyPlantAddress: { x: 358, y: 310, size: 6, maxWidth: 168, lineGap: 1 },
  },

  page2: {
    extraEquipment: { x: 377, y: 205, maxWidth: 157, size: 6 },
  },

  // N3: 4 страница = 9 значений
  page4: {
    r1: { x: 505, y: 703, size: 6.5 },
    r2: { x: 505, y: 680, size: 6.5 },
    r3: { x: 445, y: 590, size: 6.5 },
    r4: { x: 505, y: 542, size: 6.5 },
    r5: { x: 505, y: 500, size: 6.5 },

    r6: { x: 504, y: 345, size: 6.5 },
    r7: { x: 504, y: 318, size: 6.5 },
    r8: { x: 435, y: 290, size: 6.5 },
    r9: { x: 445, y: 262, size: 6.5 },
  },

  // N3: 5 страница = 5 значений
  page5: {
    r1: { x: 445, y: 471, size: 6.5 },
    r2: { x: 445, y: 448, size: 6.5 },
    // r3: { x: 450, y: 420, size: 6.5 },
    r4: { x: 445, y: 379, size: 6.5 },
    r5: { x: 445, y: 176, size: 6.5 },
  },

  // N3: 6 страница = 2 значения
  page6: {
    r1: { x: 445, y: 648, size: 6.5 },
    r2: { x: 445, y: 477, size: 6.5 },
  },

  // N3: 10 страница = дым
  page10: {
    year: { x: 434, y: 762, size: 6.5 },
    yearSuffix: { x: 448, y: 762, size: 6.5 },
    smoke: { x: 450, y: 277, size: 6.5 },
  },

  // N3: 12 страница = габариты
  page12: {
    length: { x: 443, y: 763, size: 7 },
    width: { x: 444, y: 724, size: 7 },
    height: { x: 445, y: 683, size: 7 },
  },

  // N3: 13 страница = шум
  page13: {
    noise: { x: 440, y: 776, size: 6.5 },
    // r1: { x: 505, y: 614, size: 6.5 },
    // r2: { x: 505, y: 586, size: 6.5 },
  },
},
  // O1/O2/O3/O4 — общий layout
  o: {
    page1: {
      rightColumn: {
        x: 366,
        startY: 575,
        step: 15,

        defaultSize: 6,
        yearSize: 6,
        fioSize: 6,
        addressSize: 6,

        wrapMaxWidth: 170,
        addressMaxWidth: 165,

        afterFirstDateGap: 0.01,
        afterSecondDateGap: 2,
        afterFioGap: 0.4,
        afterAddressGap: 0.8,
      },
      protocolNumber: { x: 430, y: 637, size: 7, boldOffsetX: 0.3 },
      protocolDate: { x: 270, y: 626, size: 7, boldOffsetX: 0.3 },

      conditions: {
        x: 448,
        temperatureY: 268,
        humidityY: 257,
        pressureY: 145,
        size: 5,
      },

      manufacturer: { x: 366, y: 360, size: 7 },
      manufacturerAddress: { x: 366, y: 350, size: 6, maxWidth: 160, lineGap: 1 },

      assemblyPlant: { x: 366, y: 319, size: 7 },
      assemblyPlantAddress: { x: 366, y: 310, size: 6, maxWidth: 165, lineGap: 1 },
    },

    // 2 страница O = 4 значений
    page2: {
      r1: { x: 505, y: 257, size: 6.5 },
      r2: { x: 505, y: 234, size: 6.5 },
      r3: { x: 505, y: 202, size: 6.5 },
      r4: { x: 505, y: 169, size: 6.5 },
    },

    // 3 страница O = 2 значения
    page3: {
      r1: { x: 505, y: 614, size: 6.5 },
      r2: { x: 505, y: 586, size: 6.5 },
    },

    // 4 страница O = 5 значений
    page4: {
      r1: { x: 450, y: 776, size: 6.5 },
      r2: { x: 450, y: 690, size: 6.5 },
      r3: { x: 450, y: 405, size: 6.5 },
      r4: { x: 450, y: 541, size: 6.5 },
      r5: { x: 450, y: 251, size: 6.5 },
    },
  },
};