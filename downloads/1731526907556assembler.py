import re
import math
import sys

if __name__ == '__main__':
	writefile = open(sys.argv[2], "w")
	writefile.write("v2.0 raw\n")
	writefile.write("ffffffff\n")
	with open(sys.argv[1]) as file:
		register_mapper = ['0', 'at', 'v0', 'v1', 'a0', 'a1', 'a2', 'a3', 't0',
		't1', 't2', 't3', 't4', 't5', 't6', 't7', 's0', 's1', 's2', 's3', 's4', 's5', 's6',
		's7', 't8', 't9', 'k0', 'k1', 'gp', 'sp', 'fp', 'ra']

		opcode_mapper = {"addi":"001001", "subi":"001000", "slti":"001010", "sltiu":"001011",
		"andi":"001100", "ori":"001101", "xori":"001110", "lui":"001111", "lw":"100011",
		"sw":"101011", "j":"000010", "jal":"000011", "jr":"000001", "beq":"000100", "print":
		"010000", "exit":"010111", "nop":"111111", "sll":"000000", "srl":"000000", "sra":"000000", 
		"add":"000000", "sub":"000000", "and":"000000", "or":"000000", "xor":"000000", "nor":"000000", "slt":"000000", "sltu":"000000"}

		funct_mapper = {"sll":"000000", "srl":"000010", "sra":"000011", "add":"100000",
		"sub":"100010", "and":"100100", "or":"100101", "xor":"100110", "nor":"100111",
		"slt":"101010", "sltu":"101011"}

		r_shft = ["sll", "srl", "sra"]
		r_rest = ["add", "sub", "and", "or", "xor", "nor", "slt", "sltu"]
		i_type = ["addi", "subi", "slti", "sltiu","andi", "ori", "xori", "lui"]
		j_type = ["j", "jal"]
		ls_type = ["lw", "sw"]

		labels = []
		instructions = []
		finstruction = []
		for s in file.readlines():
			s = s.lower()
			s = s.strip()
			if s == '':
				continue
			instructions.append(s)
			if ':' in s:
				labels.append((s.split(':'))[0].strip())
			else:
				labels.append('')

		for start_l, s in enumerate(instructions):
			temp = re.split(r'[,: ()]', s)
			#print(temp)
			split_instruction = []
			for x in temp:
				if x != '':
					split_instruction.append(x)
			if ':' in s:
				split_instruction.pop(0)
			decoded_instruction = ""
			identifier = split_instruction[0]
			decoded_instruction += opcode_mapper[identifier]
			if identifier in r_rest:
				rs = split_instruction[2]
				rt = split_instruction[3]
				rd = split_instruction[1]
				assert('$' in rs)
				assert('$' in rt)
				assert('$' in rd)
				decoded_instruction += str(bin(register_mapper.index(rs[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(register_mapper.index(rt[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(register_mapper.index(rd[1:])))[2:].zfill(5)

				decoded_instruction += "00000"
				decoded_instruction += funct_mapper[identifier]

			if identifier in r_shft:
				rs = split_instruction[2]
				rd = split_instruction[1]
				shamt = str(bin(int(split_instruction[3])))[2:]
				assert('$' in rs)
				assert('$' in rd)

				decoded_instruction += str(bin(register_mapper.index(rs[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(register_mapper.index(rt[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(0))[2:].zfill(5)
				decoded_instruction += shamt.zfill(5)
				decoded_instruction += funct_mapper[identifier].zfill(6)

			if identifier in i_type:
				rt = split_instruction[1]
				offset = split_instruction[3]
				rs = split_instruction[2]

				decoded_instruction += str(bin(register_mapper.index(rs[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(register_mapper.index(rt[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(int(offset)))[2:].zfill(16)

			if identifier in j_type:
				for i, l in enumerate(labels):
					if l == split_instruction[1]:
						decoded_instruction += str(bin(i+1))[2:].zfill(26)
						break

			if identifier in ls_type:
				rt = split_instruction[1]
				offset = split_instruction[2]
				rs = split_instruction[3]

				decoded_instruction += str(bin(register_mapper.index(rs[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(register_mapper.index(rt[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(int(offset)))[2:].zfill(16)


			if identifier == "beq":
				decoded_instruction = "000100"
				rs = split_instruction[1]
				rt = split_instruction[2]
				l = split_instruction[3]

				decoded_instruction += str(bin(register_mapper.index(rs[1:])))[2:].zfill(5)
				decoded_instruction += str(bin(register_mapper.index(rt[1:])))[2:].zfill(5)
				
				for i, l in enumerate(labels):
					if l == split_instruction[3]:
						decoded_instruction += str(bin(i-start_l-1))[2:].zfill(16)
						#print(start_l, i)
						break

				
			if identifier == "nop":
				decoded_instruction = "1"*32

			if identifier == "exit":
				decoded_instruction = "01011100"+"0"*24

			if identifier == "print":
				decoded_instruction = "010000"
				rs = split_instruction[1]
				decoded_instruction += str(bin(register_mapper.index(rs[1:])))[2:].zfill(5)
				decoded_instruction += "0"*21

			print(decoded_instruction)

			final_instruction = ""
			final_instruction = hex(int(decoded_instruction, 2))[2:].zfill(8)

			finstruction.append(final_instruction)
			writefile.write(final_instruction)
			writefile.write("\n")
			if identifier in ls_type:
				writefile.write("ffffffff\n")
				print("11111111111111111111111111111111")
				finstruction.append("ffffffff")
	print("ASSEMBLING DONE.")	
	print(finstruction)