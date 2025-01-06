const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

const width = 64;
const height = 32;
const imageData = ctx.createImageData(width, height);

canvas.style.width = "1280px";
canvas.style.height = "640px";

const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', (event) => {
const file = event.target.files[0];
if (file) {
   const reader = new FileReader();
   reader.readAsArrayBuffer(file);
   
   reader.onload = (e) => {
      init(new Uint8Array(e.target.result));
   };
}
});

let keys = {};
document.addEventListener("keydown", (event) => {
   keys[event.key] = true;  
});
document.addEventListener("keyup", (event) => {
   keys[event.key] = false; 
});

function draw_pixel(x, y, c) { 
   imageData.data[((y*width+x) * 4)] = (c >> 24) & 0xff;
   imageData.data[((y*width+x) * 4) + 1] = (c >> 16) & 0xff;
   imageData.data[((y*width+x) * 4) + 2] = (c >> 8) & 0xff;
   imageData.data[((y*width+x) * 4) + 3] = (c >> 0) & 0xff;
}

const PC = 0x200;

class Chip8 {
   constructor() {
      this.vn = new Uint8Array(16);
      this.memory = new Uint8Array(0xfff);
      this.ret_stack = new Uint16Array(16);
      this.framebuffer = new Uint8Array(64*32);
      this.sound_timer = 0;
      this.delay_timer = 0;
      this.key = new Uint8Array(16);
      this.speed = 10;
      this.pc = PC;
      this.sp = 0;
      this.i = 0;
   }

   init(rom) {
      this.mem_load_font();
      this.mem_load_rom(rom);
   }

   mem_load_font() {
      const font = [
         0xF0, 0x90, 0x90, 0x90, 0xF0,
         0x20, 0x60, 0x20, 0x20, 0x70,
         0xF0, 0x10, 0xF0, 0x80, 0xF0,
         0xF0, 0x10, 0xF0, 0x10, 0xF0,
         0x90, 0x90, 0xF0, 0x10, 0x10,
         0xF0, 0x80, 0xF0, 0x10, 0xF0,
         0xF0, 0x80, 0xF0, 0x90, 0xF0,
         0xF0, 0x10, 0x20, 0x40, 0x40,
         0xF0, 0x90, 0xF0, 0x90, 0xF0,
         0xF0, 0x90, 0xF0, 0x10, 0xF0,
         0xF0, 0x90, 0xF0, 0x90, 0x90,
         0xE0, 0x90, 0xE0, 0x90, 0xE0,
         0xF0, 0x80, 0x80, 0x80, 0xF0,
         0xE0, 0x90, 0x90, 0x90, 0xE0,
         0xF0, 0x80, 0xF0, 0x80, 0xF0,
         0xF0, 0x80, 0xF0, 0x80, 0x80 
      ];

      for (let i = 0; i < font.length; i++) {
         this.memory[i] = font[i];
      }
   }

   mem_load_rom(rom) {
      for (let i = 0; i < rom.length; i++) {
         this.memory[PC + i] = rom[i];
      }
   }

   cycle() {
      for (let i = 0; i < this.speed; i++) {
         this.decode();
      }

      if (this.delay_timer > 0) {
         this.delay_timer -= 1;
      }
      if (this.sound_timer > 0) {
         this.sound_timer -= 1;
      }

      this.key[0x1] = (keys['1']) ? 1 : 0;
      this.key[0x2] = (keys['2']) ? 1 : 0;
      this.key[0x3] = (keys['3']) ? 1 : 0;
      this.key[0xC] = (keys['4']) ? 1 : 0;
      this.key[0x4] = (keys['q']) ? 1 : 0;
      this.key[0x5] = (keys['w']) ? 1 : 0;
      this.key[0x6] = (keys['e']) ? 1 : 0;
      this.key[0xD] = (keys['r']) ? 1 : 0;
      this.key[0x7] = (keys['a']) ? 1 : 0;
      this.key[0x8] = (keys['s']) ? 1 : 0;
      this.key[0x9] = (keys['d']) ? 1 : 0;
      this.key[0xE] = (keys['f']) ? 1 : 0;
      this.key[0xA] = (keys['z']) ? 1 : 0;
      this.key[0x0] = (keys['x']) ? 1 : 0;
      this.key[0xB] = (keys['c']) ? 1 : 0;
      this.key[0xF] = (keys['v']) ? 1 : 0;

      for (let j = 0; j < 32; j++) {
         for (let i = 0; i < 64; i++) {
            if (this.framebuffer[j * 64 + i]) {
               draw_pixel(i, j, 0xffffffff);
            }
            else {
               draw_pixel(i, j, 0);
            }
         }
      }
      ctx.putImageData(imageData, 0, 0);
   }

   decode() {
      const hi = this.memory[this.pc];
      const lo = this.memory[this.pc+1];
      const instruction = hi << 8 | lo;
      const opcode = (instruction & 0xf000) >> 12;
      const nnn = instruction & 0x0fff;
      const nn = instruction & 0x00ff;
      const n = instruction & 0x000f;
      const x = (instruction & 0x0f00) >> 8;
      const y = (instruction & 0x00f0) >> 4;

      switch (opcode) {
         case 0x0: switch (nn) {
               case 0xe0:
                  for (let i = 0; i < this.framebuffer.length; i++) {
                     this.framebuffer[i] = 0;
                  }
                  this.draw = true;
                  this.pc += 2;
                  break;
               case 0xee:
                  this.sp -= 1;
                  let ret = this.ret_stack[this.sp];
                  this.pc = ret;
                  this.pc += 2;
                  break;
               default:
                  throw new Error(`INVALID INSTRUCTION ${instruction} AT (${this.pc})`);
            }
            break;
         case 0x1: 
            this.pc = nnn;
            break;
         case 0x2: 
            this.ret_stack[this.sp] = this.pc;
            this.sp += 1;
            this.pc = nnn;
            break;
         case 0x3: 
            if (this.vn[x] == nn) {
               this.pc += 4;
            } else {
               this.pc += 2;
            }
            break;
         case 0x4: 
            if (this.vn[x] != nn) {
               this.pc += 4;
            } else {
               this.pc += 2;
            }
            break;
         case 0x5: 
            if (this.vn[x] == this.vn[y]) {
               this.pc += 4;
            } else {
               this.pc += 2;
            }
            break;
         case 0x6: 
            this.vn[x] = nn;
            this.pc += 2;
            break;
         case 0x7: 
            this.vn[x] += nn;
            this.pc += 2;
            break;
         case 0x8: switch (n) {
               case 0x0:
                  this.vn[x] = this.vn[y];
                  this.pc += 2;
                  break;
               case 0x1:
                  this.vn[x] |= this.vn[y];
                  this.pc += 2;
                  break;
               case 0x2:
                  this.vn[x] &= this.vn[y];
                  this.pc += 2;
                  break;
               case 0x3:
                  this.vn[x] ^= this.vn[y];
                  this.pc += 2;
                  break;
               case 0x4:
                  let sum = this.vn[x];
                  sum += this.vn[y];
                  this.vn[0xf] = (sum > 0xff) ? 1 : 0;
                  this.vn[x] = sum & 0x00ff;
                  this.pc += 2;
                  break;
               case 0x5:
                  this.vn[0xf] = (this.vn[x] > this.vn[y]) ? 1 : 0;
                  this.vn[x] -= this.vn[y];
                  this.pc += 2;
                  break;
               case 0x6:
                  this.vn[0xf] = this.vn[x] & 1;
                  this.vn[x] >>= 1;
                  this.pc += 2;
                  break;
               case 0x7:
                  this.vn[0xf] = (this.vn[y] > this.vn[x]) ? 1 : 0;
                  this.vn[x] = this.vn[y] - this.vn[x];
                  this.pc += 2;
                  break;
               case 0xe:
                  this.vn[0xf] = (this.vn[x] & 128 != 0) ? 1 : 0;
                  this.vn[x] <<= 1;
                  this.pc += 2;
                  break;
               default:
                  throw new Error(`INVALID INSTRUCTION {x} ${instruction} AT (${this.pc})`);
            }
            break;
         case 0x9:
            if (this.vn[x] != this.vn[y]) {
               this.pc += 4;
            } else {
               this.pc += 2;
            }
            break;
         case 0xa:
            this.i = nnn;
            this.pc += 2;
            break;
         case 0xb:
            this.pc = this.vn[0] + nnn;
            break;
         case 0xc:
            this.vn[x] = Math.floor(Math.random() * 0xFF) & nn;
            this.pc += 2;
            break
         case 0xd:
            this.vn[0xf] = 0;
            for (let row = 0; row < n; row++) {
               let ypos = this.vn[y] % 32 + row;
               if (ypos >= 32) break;
               let sprite = this.memory[this.i + row];
               for (let col = 0; col < 8; col++) {
                  if ((sprite & (0x80 >> col)) != 0)  {
                     let xpos = this.vn[x] % 64 + col;
                     this.framebuffer[ypos * 64 + xpos] ^= 1;
                     if (this.framebuffer[ypos * 64 + xpos] == 0) {
                        this.vn[0xf] = 1;
                     }
                     if (xpos >= 64) break;
                  }
               }
            }
            this.draw = true;
            this.pc += 2;
            break;
         case 0xe: switch (nn) {
               case 0x9e:
                  console.log(keys);
                  if (this.key[this.vn[x]] == 1) {
                     this.pc += 4;
                  } else {
                     this.pc += 2;
                  }
                  break
               case 0xa1:
                  console.log(keys);
                  if (this.key[this.vn[x]] != 1) {
                     this.pc += 4;
                  } else {
                     this.pc += 2;
                  }
                  break
               default:
                  throw new Error(`INVALID INSTRUCTION ${instruction} AT (${this.pc})`);
            }
            break;  
         case 0xf: switch (nn) {
               case 0x7:
                  this.vn[x] = this.delay_timer;
                  this.pc += 2;
                  break;
               case 0xa:
                  console.log(keys);
                  let press = false;
                  let key = 0;
                  for (let i = 0; i < 16; i++) {
                     if (this.key[i] != 0) {
                        key = i;
                        press = true;
                     }
                  }
                  if (!press) {
                     this.pc -= 2;
                  } else {
                     if (this.key[key] != 0) {
                        this.pc -= 2;
                     } else {
                        this.vn[x] = key;
                        key = 0;
                        press = false;
                     }
                  }
                  this.pc += 2;
                  break;
               case 0x15:
                  this.delay_timer = this.vn[x];
                  this.pc += 2;
                  break;
               case 0x18:
                  this.sound_timer = this.vn[n];
                  this.pc += 2;
                  break;
               case 0x1e:
                  this.vn[0xf] =((this.i + this.vn[x]) > 0xfff) ? 1 : 0;
                  this.i += this.vn[x];
                  this.pc += 2;
                  break;
               case 0x29:
                  this.i = this.vn[x] * 5;
                  this.pc += 2;
                  break;
               case 0x33:
                  let value = this.vn[x];
                  this.memory[this.i + 2] =  value % 10;
                  value /= 10;
                  this.memory[this.i + 1] =  value % 10;
                  value /= 10;
                  this.memory[this.i + 0] =  value;
                  this.pc += 2;
                  break;
               case 0x55:
                  for (let i = 0; i < x + 1; i++) {
                     this.memory[this.i] = this.vn[i];
                     this.i += 1;
                  }
                  this.pc += 2;
                  break;
               case 0x65:
                  for (let i = 0; i < x + 1; i++) {
                     this.vn[i] = this.memory[this.i];
                     this.i += 1;
                  }
                  this.pc += 2;
                  break;
               default:
                  throw new Error(`INVALID INSTRUCTION ${instruction} AT (${this.pc})`);
            }
            break;
         default:
            throw new Error(`INVALID INSTRUCTION ${instruction} AT (${this.pc})`);
      }
   }
}

let loop;
let fps = 60, fpsInterval, startTime, now, then, elapsed;

const emu = new Chip8();

function init(rom) {
   fpsInterval = 1000 / fps;
	then = Date.now();
	startTime = then;
   emu.init(rom);
	loop = requestAnimationFrame(step);
}

function step() {
   now = Date.now();
	elapsed = now - then;

	if (elapsed > fpsInterval) {
		emu.cycle();
	}
   loop = requestAnimationFrame(step);
}
